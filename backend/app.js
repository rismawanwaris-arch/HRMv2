require('./utils/envLoader');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initDb } = require('./db');

const app = express();

// When running behind a reverse proxy (Tailscale, nginx, ZimaOS ingress) set
// TRUST_PROXY to the number of proxy hops so rate-limiting sees the real client IP.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || 1);
}

// Security headers. CSP is disabled because the SPA relies heavily on inline
// styles; enable and tune it once the frontend is CSP-compatible.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: restrict to configured origins. In production the frontend is served
// same-origin by this server, so browser cross-origin access is blocked unless
// CORS_ORIGIN explicitly lists allowed origins. Native mobile apps (no Origin)
// are unaffected by CORS.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => Boolean(s) && (process.env.NODE_ENV !== 'production' || s !== '*'));
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Mobile-App-Key'],
  }));
} else if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Mobile-App-Key'],
  }));
} else {
  app.use(cors({ origin: false }));
}

app.use(express.json({ limit: '1mb' }));

// Harden all /api responses against proxy/browser caching and referrer leaks
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Kick off schema initialization. Consumers can await `app.locals.dbReady`
// before serving traffic / running tests.
app.locals.dbReady = initDb()
  .then(() => {
    if (process.env.NODE_ENV !== 'test') console.log('Database initialized successfully.');
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    throw err;
  });

// --- API ENDPOINTS ---

const { authenticateToken } = require('./middleware/auth');
const { auditLog } = require('./middleware/audit');
const { requireRole } = require('./middleware/roleCheck');

const STAFF   = ['staff', 'finance', 'master'];
const FINANCE = ['finance', 'master'];
const MASTER  = ['master'];

app.use('/api', require('./routes/authRoutes'));
app.use('/api/dashboard',  authenticateToken, requireRole(...STAFF),   require('./routes/dashboardRoutes'));
app.use('/api/audit-log',  authenticateToken, requireRole(...MASTER),  require('./routes/auditRoutes'));
app.use('/api/employees',  authenticateToken, auditLog, requireRole(...FINANCE), require('./routes/employeeRoutes'));
app.use('/api/candidates', authenticateToken, auditLog, requireRole('staff', 'master'), require('./routes/candidateRoutes'));
app.use('/api/stages',     authenticateToken, auditLog, requireRole('staff', 'master'), require('./routes/stageRoutes'));
app.use('/api/branches',   authenticateToken, auditLog, requireRole(...STAFF),   require('./routes/branchRoutes'));
app.use('/api/settings',   authenticateToken, auditLog, requireRole(...MASTER),  require('./routes/settingsRoutes'));
app.use('/api/staff',      authenticateToken, auditLog, requireRole(...FINANCE), require('./routes/staffRoutes'));
app.use('/api/attendance', authenticateToken, auditLog, requireRole(...STAFF),   require('./routes/attendanceRoutes'));
app.use('/api/payroll',    authenticateToken, auditLog, requireRole(...FINANCE), require('./routes/payrollRoutes'));
app.use('/api/financial',  authenticateToken, auditLog, requireRole(...FINANCE), require('./routes/financialRoutes'));
app.use('/api/discipline', authenticateToken, auditLog, requireRole(...FINANCE), require('./routes/disciplineRoutes'));
app.use('/api/leaves',     authenticateToken, auditLog, requireRole(...STAFF),   require('./routes/leaveRoutes'));
app.use('/api/loans',      authenticateToken, auditLog, requireRole(...FINANCE), require('./routes/loanRoutes'));
app.use('/api/claims',     authenticateToken, auditLog, requireRole(...STAFF),   require('./routes/claimsRoutes'));
app.use('/api/outlet-activity', authenticateToken, auditLog, requireRole(...STAFF), require('./routes/outletActivityRoutes'));
app.use('/api/assets',          authenticateToken, auditLog, requireRole(...STAFF), require('./routes/assetRoutes'));
const { mobileRouter, legacyAliasRouter } = require('./routes/mobileRoutes');
app.use('/api/mobile',          mobileRouter);
app.use('/api',                 legacyAliasRouter); // Backward-compatible aliases (e.g. /api/master-data, /api/sync/*)
app.use('/api', require('./routes/testRoutes'));

// Strict JSON 404 response for unhandled /api/* requests (mencegah HTML fallback terkirim ke mobile app)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan di server.`
  });
});

// --- SERVE DOCUMENTATION (MASTER ONLY) & FRONTEND STATIC FILES ---
app.use(
  '/docs',
  authenticateToken,
  requireRole(...MASTER),
  express.static(path.join(__dirname, '..', 'docs'), { dotfiles: 'deny', index: false })
);
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendBuildPath));

// SPA fallback: any non-API route serves the React app
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

// Global JSON error handler for API requests
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Ukuran file melebihi batas maksimal yang diizinkan.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Jumlah file melebihi batas maksimal yang diizinkan.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Field file yang diunggah tidak sesuai.'
      });
    }
    const status = err.status || (err.message && err.message.includes('Format file') ? 400 : 500);
    if (status >= 500) {
      console.error('Unhandled API error:', err);
    }
    return res.status(status).json({
      success: false,
      message: status < 500 ? err.message : 'Terjadi kesalahan internal pada server.'
    });
  }
  next(err);
});

module.exports = app;
