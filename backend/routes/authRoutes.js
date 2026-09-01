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

const { requireRole } = require('../middleware/roleCheck');

router.post('/login', ...loginHandlers);
router.post('/change-password', authenticateToken, auditLog, authController.changePassword);

// Admin management — master only
router.get('/admins', authenticateToken, requireRole('master'), authController.listAdmins);
router.post('/admins', authenticateToken, auditLog, requireRole('master'), authController.createAdmin);
router.put('/admins/:id/role', authenticateToken, auditLog, requireRole('master'), authController.updateAdminRole);
router.delete('/admins/:id', authenticateToken, auditLog, requireRole('master'), authController.deleteAdmin);

module.exports = router;
