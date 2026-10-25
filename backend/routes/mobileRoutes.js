const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { requireRole } = require('../middleware/roleCheck');
const { outletPhotoUpload } = require('../utils/helpers');

const STAFF = ['staff', 'finance', 'master'];

// Throttle brute-force login attempts: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }
});

// Throttle sync & API requests to prevent flooding / DoS: max 120 requests per minute per IP
const mobileApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan sinkronisasi. Silakan tunggu sebentar.' }
});

const loginHandlers = process.env.NODE_ENV === 'test'
  ? [authController.login]
  : [loginLimiter, authController.login];

const apiProtection = process.env.NODE_ENV === 'test'
  ? [authenticateToken, requireRole(...STAFF)]
  : [mobileApiLimiter, authenticateToken, requireRole(...STAFF)];

// --- 1. Autentikasi Pengguna Mobile (Dilindungi Brute-Force Rate Limiter) ---
// Mendukung POST /api/login maupun POST /api/mobile/login
router.post('/login', ...loginHandlers);
router.post('/mobile/login', ...loginHandlers);

// --- 2. Master Data & Cache Cabang (Wajib Autentikasi Bearer Token) ---
// Mendukung GET /api/mobile/master-data maupun GET /api/master-data
router.get('/master-data', ...apiProtection, mobileController.getMasterData);
router.get('/mobile/master-data', ...apiProtection, mobileController.getMasterData);

// --- 3. Offline-First Sync Endpoints (Idempotent by client_uuid) ---
// Memerlukan JWT Token, Role Validation, Audit Logging, & Upload Filter
router.post('/sync/asset', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncAsset);
router.post('/mobile/sync/asset', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncAsset);

router.post('/sync/visit', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncVisit);
router.post('/mobile/sync/visit', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncVisit);

router.post('/sync/incident', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncIncident);
router.post('/mobile/sync/incident', ...apiProtection, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncIncident);

router.post('/sync/employee', ...apiProtection, auditLog, mobileController.syncEmployee);
router.post('/mobile/sync/employee', ...apiProtection, auditLog, mobileController.syncEmployee);

// --- 4. Online Browse & Search Endpoints (Wajib Autentikasi & Data Minimization) ---
router.get('/assets', ...apiProtection, mobileController.getAssets);
router.get('/mobile/assets', ...apiProtection, mobileController.getAssets);

router.get('/employees', ...apiProtection, mobileController.getEmployees);
router.get('/mobile/employees', ...apiProtection, mobileController.getEmployees);

module.exports = router;
