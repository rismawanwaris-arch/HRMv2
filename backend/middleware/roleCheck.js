/**
 * Middleware factory — restricts a route to specific admin roles.
 * Usage: requireRole('master') or requireRole('finance', 'master')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user && req.user.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Peran Anda tidak memiliki izin untuk tindakan ini.' });
    }
    next();
  };
}

module.exports = { requireRole };
