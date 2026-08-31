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
// same-origin by this server, so no CORS headers are needed unless CORS_ORIGIN
// is set. In development the Vite dev server is cross-origin, so allow it.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }));
} else if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}

app.use(express.json({ limit: '1mb' }));

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

app.use('/api', require('./routes/authRoutes'));
app.use('/api/dashboard', authenticateToken, require('./routes/dashboardRoutes'));
app.use('/api/audit-log', authenticateToken, require('./routes/auditRoutes'));
app.use('/api/employees', authenticateToken, auditLog, require('./routes/employeeRoutes'));
app.use('/api/candidates', authenticateToken, auditLog, require('./routes/candidateRoutes'));
app.use('/api/stages', authenticateToken, auditLog, require('./routes/stageRoutes'));
app.use('/api/branches', authenticateToken, auditLog, require('./routes/branchRoutes'));
app.use('/api', require('./routes/testRoutes'));

// --- SERVE FRONTEND STATIC FILES IN PRODUCTION ---
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendBuildPath));

// SPA fallback: any non-API route serves the React app
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

module.exports = app;
