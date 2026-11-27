const { verifyToken } = require('../utils/crypto');
const { query } = require('../db');
const { getMobileSessionPolicy } = require('../utils/mobileSessionPolicy');

const QUERY_TOKEN_ALLOWED_PATHS = /^\/api\/(outlet-activity\/photos\/[^/?#]+|mobile\/photos\/[^/?#]+|candidates\/template-excel|candidates\/\d+\/documents\/\d+\/file)(\?|$)/;
const LAST_ACTIVE_THROTTLE_MS = 30 * 1000;

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

    // Per-device mobile session verification & server-side idle timeout enforcement
    let sessionExpiresAt = decoded.exp ? new Date(decoded.exp).toISOString() : null;
    if (decoded.aud === 'mobile' && decoded.sid) {
      const session = await query.get(
        'SELECT session_id, last_active_at, expires_at, revoked_at FROM mobile_sessions WHERE session_id = ? AND admin_id = ?',
        [decoded.sid, admin.id]
      );
      if (!session || session.revoked_at) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: 'Sesi perangkat mobile Anda telah dicabut. Silakan login kembali.',
        });
      }

      const policy = await getMobileSessionPolicy();
      const nowMs = Date.now();
      const lastActiveMs = Date.parse(session.last_active_at || '');
      const idleLimitMs = policy.idle_timeout_minutes * 60 * 1000;
      if (Number.isFinite(lastActiveMs) && nowMs - lastActiveMs > idleLimitMs) {
        await query.run(
          "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'idle_timeout' WHERE session_id = ? AND revoked_at IS NULL",
          [new Date(nowMs).toISOString(), decoded.sid]
        );
        return res.status(401).json({
          success: false,
          code: 'SESSION_IDLE_TIMEOUT',
          message: `Sesi mobile berakhir karena tidak ada aktivitas lebih dari ${policy.idle_timeout_minutes} menit. Silakan login kembali.`,
        });
      }

      if (!Number.isFinite(lastActiveMs) || nowMs - lastActiveMs >= LAST_ACTIVE_THROTTLE_MS) {
        await query.run(
          'UPDATE mobile_sessions SET last_active_at = ? WHERE session_id = ?',
          [new Date(nowMs).toISOString(), decoded.sid]
        );
      }
      sessionExpiresAt = session.expires_at || sessionExpiresAt;
    }

    req.user = {
      ...decoded,
      id: admin.id,
      username: admin.username,
      role: admin.role || 'master',
      token_version: currentVersion,
      sid: decoded.sid || null,
      session_expires_at: sessionExpiresAt,
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
