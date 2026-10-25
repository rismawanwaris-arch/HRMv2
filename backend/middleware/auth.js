const { verifyToken } = require('../utils/crypto');
const { query } = require('../db');

/**
 * Express middleware to authenticate route access using Bearer token signature
 * and verify that the admin account is still active in the database.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
    // Allow query token ONLY for safe GET requests (e.g. <img src=".../photos/...?token=...">)
    const queryToken = req.method === 'GET' ? req.query.token : null;
    const token = bearerToken || queryToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.username) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Token tidak valid atau kedaluwarsa.' });
    }

    // Verify account still exists in database & enforce live role (instant revocation support)
    const admin = await query.get('SELECT id, username, role FROM admins WHERE username = ?', [decoded.username]);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Akun sudah tidak aktif.' });
    }

    req.user = {
      ...decoded,
      id: admin.id,
      username: admin.username,
      role: admin.role || 'master'
    };
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error processing authentication.' });
  }
}

module.exports = {
  authenticateToken
};
