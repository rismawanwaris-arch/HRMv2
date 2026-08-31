const { verifyToken } = require('../utils/crypto');

/**
 * Express middleware to authenticate route access using Bearer token signature.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Token tidak valid atau kedaluwarsa.' });
    }

    req.user = decoded; // Attach parsed user context
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error processing authentication.' });
  }
}

module.exports = {
  authenticateToken
};
