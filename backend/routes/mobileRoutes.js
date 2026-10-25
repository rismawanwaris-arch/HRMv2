const express = require('express');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { outletPhotoUpload } = require('../utils/helpers');

// --- 1. Autentikasi Pengguna Mobile (Public) ---
// Mendukung POST /api/login maupun POST /api/mobile/login
router.post('/login', authController.login);
router.post('/mobile/login', authController.login);

// --- 2. Master Data & Cache Cabang ---
// Mendukung GET /api/mobile/master-data maupun GET /api/master-data
router.get('/master-data', mobileController.getMasterData);
router.get('/mobile/master-data', mobileController.getMasterData);

// --- 3. Offline-First Sync Endpoints (Idempotent by client_uuid) ---
// Memerlukan JWT Token & logging audit
router.post('/sync/asset', authenticateToken, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncAsset);
router.post('/mobile/sync/asset', authenticateToken, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncAsset);

router.post('/sync/visit', authenticateToken, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncVisit);
router.post('/mobile/sync/visit', authenticateToken, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncVisit);

router.post('/sync/incident', authenticateToken, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncIncident);
router.post('/mobile/sync/incident', authenticateToken, auditLog, outletPhotoUpload.array('photos', 5), mobileController.syncIncident);

router.post('/sync/employee', authenticateToken, auditLog, mobileController.syncEmployee);
router.post('/mobile/sync/employee', authenticateToken, auditLog, mobileController.syncEmployee);

// --- 4. Online Browse & Search Endpoints ---
router.get('/assets', authenticateToken, mobileController.getAssets);
router.get('/mobile/assets', authenticateToken, mobileController.getAssets);

router.get('/employees', authenticateToken, mobileController.getEmployees);
router.get('/mobile/employees', authenticateToken, mobileController.getEmployees);

module.exports = router;
