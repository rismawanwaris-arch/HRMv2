const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// Throttle credential-guessing: 10 attempts per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }
});

const loginHandlers = process.env.NODE_ENV === 'test'
  ? [authController.login]
  : [loginLimiter, authController.login];

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan ganti password. Coba lagi dalam 15 menit.' }
});

const changePasswordHandlers = process.env.NODE_ENV === 'test'
  ? [authenticateToken, auditLog, authController.changePassword]
  : [changePasswordLimiter, authenticateToken, auditLog, authController.changePassword];

const { requireRole } = require('../middleware/roleCheck');

router.post('/login', ...loginHandlers);
router.post('/logout', authenticateToken, auditLog, authController.logout);
router.post('/change-password', ...changePasswordHandlers);

// Admin management — master only
router.get('/admins', authenticateToken, requireRole('master'), authController.listAdmins);
router.post('/admins', authenticateToken, auditLog, requireRole('master'), authController.createAdmin);
router.put('/admins/:id/role', authenticateToken, auditLog, requireRole('master'), authController.updateAdminRole);
router.post('/admins/:id/revoke-sessions', authenticateToken, auditLog, requireRole('master'), authController.revokeAdminSessions);
router.delete('/admins/:id', authenticateToken, auditLog, requireRole('master'), authController.deleteAdmin);

// Mobile session management — master only
router.get('/mobile-sessions', authenticateToken, requireRole('master'), authController.listMobileSessions);
router.post('/mobile-sessions/revoke-all', authenticateToken, auditLog, requireRole('master'), authController.revokeAllMobileSessions);
router.post('/mobile-sessions/:sessionId/revoke', authenticateToken, auditLog, requireRole('master'), authController.revokeMobileSession);

module.exports = router;
