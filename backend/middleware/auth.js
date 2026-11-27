const { verifyToken } = require('../utils/crypto');
const { query } = require('../db');

const QUERY_TOKEN_ALLOWED_PATHS = /^\/api\/(outlet-activity\/photos\/[^/?#]+|mobile\/photos\/[^/?#]+|candidates\/template-excel|candidates\/\d+\/documents\/\d+\/file)(\?|$)/;

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
    // Allow query token ONLY for safe GET binary media/download endpoints (never general JSON APIs)
    const allowQueryToken = req.method === 'GET' && QUERY_TOKEN_ALLOWED_PATHS.test(req.originalUrl || '');
    const queryToken = allowQueryToken ? req.query.token : null;
    const token = bearerToken || queryToken;

    if (!token) {
      return res.status(401).json({ success: false, code: 'TOKEN_MISSING', message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.username) {
      return res.status(401).json({ success: false, code: 'TOKEN_INVALID', message: 'Akses ditolak. Token tidak valid atau kedaluwarsa.' });
    }

    // Verify account still exists in database & enforce live role + token_version (instant revocation support)
    const admin = await query.get(
      'SELECT id, username, role, COALESCE(token_version, 1) AS token_version FROM admins WHERE username = ?',
      [decoded.username]
    );
    if (!admin) {
      return res.status(401).json({ success: false, code: 'ACCOUNT_INACTIVE', message: 'Akses ditolak. Akun sudah tidak aktif.' });
    }

    const currentVersion = Number(admin.token_version || 1);
    const tokenVersion = decoded.tv !== undefined ? Number(decoded.tv) : 1;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_REVOKED',
        message: 'Sesi Anda telah dicabut atau password telah diubah. Silakan login kembali.',
      });
    }

    req.user = {
      ...decoded,
      id: admin.id,
      username: admin.username,
      role: admin.role || 'master',
      token_version: currentVersion,
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
