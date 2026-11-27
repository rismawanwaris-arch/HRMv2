const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const mobileController = require('../controllers/mobileController');
const authController = require('../controllers/authController');
const attendanceController = require('../controllers/attendanceController');
const leaveController = require('../controllers/leaveController');
const claimsController = require('../controllers/claimsController');
const outletActivityController = require('../controllers/outletActivityController');
const { authenticateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { requireRole } = require('../middleware/roleCheck');
const { outletPhotoUpload, enforceImageMagicBytes } = require('../utils/helpers');

const STAFF = ['staff', 'finance', 'master'];
const FINANCE = ['finance', 'master'];

/**
 * Optional mobile client attestation guard: when MOBILE_API_KEY is configured,
 * require callers on mobile login & protected mobile APIs to send a matching
 * X-Mobile-App-Key header (checked in constant time).
 */
function verifyMobileAppKey(req, res, next) {
  const configuredKey = (process.env.MOBILE_API_KEY || '').trim();
  if (!configuredKey) return next();
  const provided = String(req.headers['x-mobile-app-key'] || '').trim();
  const expectedBuf = Buffer.from(configuredKey, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (
    expectedBuf.length === 0 ||
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return res.status(403).json({
      success: false,
      code: 'INVALID_APP_KEY',
      message: 'Kunci aplikasi mobile tidak valid atau tidak terdaftar.',
    });
  }
  return next();
}

// Throttle brute-force login attempts: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

// Throttle sync & API requests to prevent flooding / DoS: max 120 requests per minute per IP
const mobileApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan sinkronisasi. Silakan tunggu sebentar.' },
});

const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan health check.' },
});

const healthHandlers = process.env.NODE_ENV === 'test'
  ? [mobileController.health]
  : [healthLimiter, mobileController.health];

const loginHandlers = process.env.NODE_ENV === 'test'
  ? [verifyMobileAppKey, authController.login]
  : [verifyMobileAppKey, loginLimiter, authController.login];

const apiProtection = process.env.NODE_ENV === 'test'
  ? [verifyMobileAppKey, authenticateToken, requireRole(...STAFF)]
  : [verifyMobileAppKey, mobileApiLimiter, authenticateToken, requireRole(...STAFF)];

const todayAttendanceHandler = (req, res, next) => {
  if (!req.query.date) {
    const now = new Date();
    req.query.date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return attendanceController.getByDate(req, res, next);
};

// Canonical /api/mobile/* router
const mobileRouter = express.Router();

// --- 0. Health Check & Session Identity ---
mobileRouter.get('/health', ...healthHandlers);
mobileRouter.post('/login', ...loginHandlers);
mobileRouter.post('/logout', ...apiProtection, auditLog, authController.logout);
mobileRouter.get('/me', ...apiProtection, mobileController.me);

// --- 1. Master Data & Photo Stream ---
mobileRouter.get('/master-data', ...apiProtection, mobileController.getMasterData);
mobileRouter.get('/photos/:filename', ...apiProtection, outletActivityController.servePhoto);

// --- 2. Offline-First Sync Endpoints (Idempotent by client_uuid) ---
mobileRouter.post('/sync/asset', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, mobileController.syncAsset);
mobileRouter.post('/sync/visit', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, mobileController.syncVisit);
mobileRouter.post('/sync/incident', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, mobileController.syncIncident);
mobileRouter.post('/sync/employee', ...apiProtection, requireRole(...FINANCE), auditLog, mobileController.syncEmployee);

// --- 3. Online Browse & Search Endpoints (PII Minimized) ---
mobileRouter.get('/assets', ...apiProtection, mobileController.getAssets);
mobileRouter.get('/employees', ...apiProtection, mobileController.getEmployees);

// --- 4. Attendance & Geofence Check-in ---
mobileRouter.post('/attendance/checkin', ...apiProtection, auditLog, outletPhotoUpload.single('photo'), enforceImageMagicBytes, mobileController.checkInAttendance);
mobileRouter.get('/attendance/today', ...apiProtection, todayAttendanceHandler);
mobileRouter.get('/attendance/history', ...apiProtection, mobileController.getAttendanceHistory);

// --- 5. Leave Management (Cuti & Izin) ---
mobileRouter.get('/leaves/types', ...apiProtection, leaveController.getTypes);
mobileRouter.get('/leaves/balances', ...apiProtection, leaveController.getBalances);
mobileRouter.get('/leaves/requests', ...apiProtection, leaveController.getRequests);
mobileRouter.post('/leaves/requests', ...apiProtection, auditLog, leaveController.createRequest);
mobileRouter.put('/leaves/requests/:id/approve', ...apiProtection, requireRole(...FINANCE), auditLog, leaveController.approveRequest);
mobileRouter.put('/leaves/requests/:id/reject', ...apiProtection, requireRole(...FINANCE), auditLog, leaveController.rejectRequest);
mobileRouter.put('/leaves/requests/:id/cancel', ...apiProtection, auditLog, leaveController.cancelRequest);

// --- 6. Overtime & Reimbursements ---
mobileRouter.get('/overtime', ...apiProtection, claimsController.getOvertime);
mobileRouter.post('/overtime', ...apiProtection, auditLog, claimsController.createOvertime);
mobileRouter.put('/overtime/:id/approve', ...apiProtection, requireRole(...FINANCE), auditLog, claimsController.approveOvertime);
mobileRouter.put('/overtime/:id/reject', ...apiProtection, requireRole(...FINANCE), auditLog, claimsController.rejectOvertime);

mobileRouter.get('/reimbursements', ...apiProtection, claimsController.getReimbursements);
mobileRouter.post('/reimbursements', ...apiProtection, auditLog, outletPhotoUpload.single('receipt'), enforceImageMagicBytes, claimsController.createReimbursement);
mobileRouter.put('/reimbursements/:id/approve', ...apiProtection, requireRole(...FINANCE), auditLog, claimsController.approveReimbursement);
mobileRouter.put('/reimbursements/:id/reject', ...apiProtection, requireRole(...FINANCE), auditLog, claimsController.rejectReimbursement);

// Legacy non-colliding /api/* aliases for backward compatibility with older mobile clients/tests
const legacyAliasRouter = express.Router();
legacyAliasRouter.get('/master-data', ...apiProtection, mobileController.getMasterData);
legacyAliasRouter.post('/sync/asset', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, mobileController.syncAsset);
legacyAliasRouter.post('/sync/visit', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, mobileController.syncVisit);
legacyAliasRouter.post('/sync/incident', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, mobileController.syncIncident);
legacyAliasRouter.post('/sync/employee', ...apiProtection, requireRole(...FINANCE), auditLog, mobileController.syncEmployee);
legacyAliasRouter.post('/attendance/checkin', ...apiProtection, auditLog, outletPhotoUpload.single('photo'), enforceImageMagicBytes, mobileController.checkInAttendance);

module.exports = { mobileRouter, legacyAliasRouter };
