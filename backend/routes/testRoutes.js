const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const testController = require('../controllers/testController');

const { authenticateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { requireRole } = require('../middleware/roleCheck');

const testPortalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan akses portal ujian. Coba lagi nanti.' },
});

const portalGuard = process.env.NODE_ENV === 'test' ? [] : [testPortalLimiter];

router.get('/test/validate/:code', ...portalGuard, testController.validateTestAccess);
router.get('/test/questions/:code', ...portalGuard, testController.getTestQuestions);
router.post('/test/submit', ...portalGuard, testController.submitTest);

router.get('/admin/questions', authenticateToken, requireRole('staff', 'master'), testController.getAdminQuestions);
router.post('/admin/questions', authenticateToken, auditLog, requireRole('staff', 'master'), testController.addAdminQuestion);
router.put('/admin/questions/:id', authenticateToken, auditLog, requireRole('staff', 'master'), testController.updateAdminQuestion);
router.delete('/admin/questions/:id', authenticateToken, auditLog, requireRole('master'), testController.deleteAdminQuestion);

router.get('/admin/training-questions', authenticateToken, requireRole('staff', 'master'), testController.getTrainingQuestions);
router.post('/admin/training-questions', authenticateToken, auditLog, requireRole('staff', 'master'), testController.addTrainingQuestion);
router.put('/admin/training-questions/:id', authenticateToken, auditLog, requireRole('staff', 'master'), testController.updateTrainingQuestion);
router.delete('/admin/training-questions/:id', authenticateToken, auditLog, requireRole('master'), testController.deleteTrainingQuestion);

router.get('/training-test/validate/:code', ...portalGuard, testController.validateTrainingTest);
router.post('/training-test/submit', ...portalGuard, testController.submitTrainingTest);

module.exports = router;
