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
const { outletPhotoUpload } = require('../utils/helpers');

const STAFF = ['staff', 'finance', 'master'];
const FINANCE = ['finance', 'master'];

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

const loginHandlers = process.env.NODE_ENV === 'test'
  ? [authController.login]
  : [loginLimiter, authController.login];

const apiProtection = process.env.NODE_ENV === 'test'
  ? [authenticateToken, requireRole(...STAFF)]
  : [mobileApiLimiter, authenticateToken, requireRole(...STAFF)];

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
mobileRouter.get('/health', mobileController.health);
mobileRouter.post('/login', ...loginHandlers);
mobileRouter.get('/me', ...apiProtection, mobileController.me);

// --- 1. Master Data & Photo Stream ---
mobileRouter.get('/master-data', ...apiProtection, mobileController.getMasterData);
mobileRouter.get('/photos/:filename', ...apiProtection, outletActivityController.servePhoto);

// --- 2. Offline-First Sync Endpoints (Idempotent by client_uuid) ---
mobileRouter.post('/sync/asset', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncAsset);
mobileRouter.post('/sync/visit', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncVisit);
mobileRouter.post('/sync/incident', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncIncident);
mobileRouter.post('/sync/employee', ...apiProtection, auditLog, mobileController.syncEmployee);

// --- 3. Online Browse & Search Endpoints (PII Minimized) ---
mobileRouter.get('/assets', ...apiProtection, mobileController.getAssets);
mobileRouter.get('/employees', ...apiProtection, mobileController.getEmployees);

// --- 4. Attendance & Geofence Check-in ---
mobileRouter.post('/attendance/checkin', ...apiProtection, auditLog, outletPhotoUpload.single('photo'), mobileController.checkInAttendance);
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
mobileRouter.post('/reimbursements', ...apiProtection, auditLog, outletPhotoUpload.single('receipt'), claimsController.createReimbursement);
mobileRouter.put('/reimbursements/:id/approve', ...apiProtection, requireRole(...FINANCE), auditLog, claimsController.approveReimbursement);
mobileRouter.put('/reimbursements/:id/reject', ...apiProtection, requireRole(...FINANCE), auditLog, claimsController.rejectReimbursement);

// Legacy non-colliding /api/* aliases for backward compatibility with older mobile clients/tests
const legacyAliasRouter = express.Router();
legacyAliasRouter.get('/master-data', ...apiProtection, mobileController.getMasterData);
legacyAliasRouter.post('/sync/asset', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncAsset);
legacyAliasRouter.post('/sync/visit', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncVisit);
legacyAliasRouter.post('/sync/incident', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncIncident);
legacyAliasRouter.post('/sync/employee', ...apiProtection, auditLog, mobileController.syncEmployee);
legacyAliasRouter.post('/attendance/checkin', ...apiProtection, auditLog, outletPhotoUpload.single('photo'), mobileController.checkInAttendance);

module.exports = { mobileRouter, legacyAliasRouter };
