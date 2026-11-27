const crypto = require('crypto');
const { query } = require('../db');
const { verifyPassword, generateToken, hashPassword, needsRehash } = require('../utils/crypto');
const { getMobileSessionPolicy } = require('../utils/mobileSessionPolicy');

const MIN_PASSWORD_LENGTH = 8;

function sanitizeDeviceField(val, maxLen = 120) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s ? s.slice(0, maxLen) : null;
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }
    const admin = await query.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (admin && verifyPassword(password, admin.password)) {
      // Transparently upgrade legacy/low-iteration hashes on successful login.
      if (needsRehash(admin.password)) {
        try {
          await query.run('UPDATE admins SET password = ? WHERE id = ?', [hashPassword(password), admin.id]);
        } catch (e) {
          console.error('Password rehash failed:', e);
        }
      }
      const role = admin.role || 'master';
      const isMobile = req.baseUrl === '/api/mobile' || (req.originalUrl || '').startsWith('/api/mobile/');
      const tv = Number(admin.token_version || 1);

      if (isMobile) {
        const policy = await getMobileSessionPolicy();
        const ttlMs = policy.token_ttl_hours * 3600 * 1000;
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const expiresAtIso = new Date(nowMs + ttlMs).toISOString();
        const sid = crypto.randomUUID();

        if (policy.single_device_mode) {
          await query.run(
            "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'new_device_login' WHERE admin_id = ? AND revoked_at IS NULL",
            [nowIso, admin.id]
          );
        }

        const deviceId = sanitizeDeviceField(req.body.device_id, 128);
        const deviceName = sanitizeDeviceField(req.body.device_name, 128) || sanitizeDeviceField(req.headers['user-agent'], 128) || 'Flutter Mobile';
        const platform = sanitizeDeviceField(req.body.platform, 32) || 'mobile';
        const appVersion = sanitizeDeviceField(req.body.app_version, 32);
        const ipAddress = sanitizeDeviceField(req.ip || req.socket?.remoteAddress, 64);

        await query.run(
          `INSERT INTO mobile_sessions (
            session_id, admin_id, username, device_id, device_name, platform, app_version,
            ip_address, created_at, last_active_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sid, admin.id, admin.username, deviceId, deviceName, platform, appVersion, ipAddress, nowIso, nowIso, expiresAtIso]
        );

        const token = generateToken(admin.username, { role, tv, aud: 'mobile', sid }, ttlMs);
        return res.json({
          success: true,
          message: 'Login berhasil.',
          token,
          session_id: sid,
          expires_in: Math.floor(ttlMs / 1000),
          expires_at: expiresAtIso,
          session_policy: policy,
          role,
          username: admin.username,
          user: {
            id: admin.id,
            username: admin.username,
            name: admin.username === 'admin' ? 'Administrator HRGA' : admin.username,
            role
          }
        });
      }

      const ttlMs = 24 * 3600 * 1000;
      const token = generateToken(admin.username, { role, tv, aud: 'web' }, ttlMs);
      res.json({
        success: true,
        message: 'Login berhasil.',
        token,
        expires_in: Math.floor(ttlMs / 1000),
        expires_at: new Date(Date.now() + ttlMs).toISOString(),
        role,
        username: admin.username,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.username === 'admin' ? 'Administrator HRGA' : admin.username,
          role
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error saat login.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    // Identity comes from the authenticated token, never from the request body.
    const username = req.user && req.user.username;
    const { oldPassword, newPassword } = req.body;

    if (!username) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid.' });
    }
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi.' });
    }
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, message: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.` });
    }

    const admin = await query.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (admin && verifyPassword(oldPassword, admin.password)) {
      const hashed = hashPassword(newPassword);
      await query.run(
        'UPDATE admins SET password = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
        [hashed, admin.id]
      );
      await query.run(
        "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'password_changed' WHERE admin_id = ? AND revoked_at IS NULL",
        [new Date().toISOString(), admin.id]
      );
      res.json({ success: true, message: 'Password berhasil diubah. Semua sesi aktif lainnya telah dicabut.' });
    } else {
      res.status(401).json({ success: false, message: 'Password lama tidak cocok.' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error saat mengganti password.' });
  }
};

const VALID_ROLES = ['staff', 'finance', 'master'];

exports.listAdmins = async (req, res) => {
  try {
    const rows = await query.all('SELECT id, username, role FROM admins ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password || !role) {
      return res.status(400).json({ success: false, message: 'Username, password, dan role wajib diisi.' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid.' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, message: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` });
    }
    const existing = await query.get('SELECT id FROM admins WHERE username = ?', [cleanUsername]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
    }
    const hashed = hashPassword(password);
    const result = await query.run(
      'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
      [cleanUsername, hashed, role]
    );
    res.json({ success: true, data: { id: result.id, username: cleanUsername, role }, message: 'Akun admin berhasil dibuat.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateAdminRole = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid.' });
    }
    const target = await query.get('SELECT id FROM admins WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Akun admin tidak ditemukan.' });
    }
    // Prevent demoting yourself
    const self = await query.get('SELECT id FROM admins WHERE username = ?', [req.user.username]);
    if (self && self.id === id) {
      return res.status(400).json({ success: false, message: 'Tidak bisa mengubah role akun Anda sendiri.' });
    }
    await query.run('UPDATE admins SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true, message: 'Role berhasil diubah.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const target = await query.get('SELECT id, role FROM admins WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Akun admin tidak ditemukan.' });
    }
    // Prevent deleting yourself
    const self = await query.get('SELECT id FROM admins WHERE username = ?', [req.user.username]);
    if (self && self.id === id) {
      return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun Anda sendiri.' });
    }
    // Ensure at least one master remains
    if (target.role === 'master') {
      const masterCount = await query.get("SELECT COUNT(*) as cnt FROM admins WHERE role = 'master'");
      if (masterCount.cnt <= 1) {
        return res.status(400).json({ success: false, message: 'Harus ada minimal satu akun master.' });
      }
    }
    await query.run('DELETE FROM admins WHERE id = ?', [id]);
    res.json({ success: true, message: 'Akun admin berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.logout = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid.' });
    }
    const nowIso = new Date().toISOString();
    await query.run(
      'UPDATE admins SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
      [req.user.id]
    );
    await query.run(
      "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'user_logout' WHERE admin_id = ? AND revoked_at IS NULL",
      [nowIso, req.user.id]
    );
    res.json({ success: true, message: 'Logout berhasil. Semua sesi aktif akun ini telah dicabut.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Server error saat logout.' });
  }
};

exports.refreshMobileSession = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, code: 'TOKEN_INVALID', message: 'Sesi tidak valid.' });
    }
    const policy = await getMobileSessionPolicy();
    const ttlMs = policy.token_ttl_hours * 3600 * 1000;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expiresAtIso = new Date(nowMs + ttlMs).toISOString();
    const sid = req.user.sid || crypto.randomUUID();

    if (req.user.sid) {
      await query.run(
        'UPDATE mobile_sessions SET last_active_at = ?, expires_at = ? WHERE session_id = ? AND admin_id = ? AND revoked_at IS NULL',
        [nowIso, expiresAtIso, sid, req.user.id]
      );
    } else {
      await query.run(
        `INSERT INTO mobile_sessions (
          session_id, admin_id, username, device_name, platform, ip_address,
          created_at, last_active_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sid,
          req.user.id,
          req.user.username,
          sanitizeDeviceField(req.headers['user-agent'], 128) || 'Flutter Mobile',
          'mobile',
          sanitizeDeviceField(req.ip || req.socket?.remoteAddress, 64),
          nowIso,
          nowIso,
          expiresAtIso,
        ]
      );
    }

    const token = generateToken(
      req.user.username,
      { role: req.user.role, tv: req.user.token_version, aud: 'mobile', sid },
      ttlMs
    );

    res.json({
      success: true,
      message: 'Sesi mobile berhasil diperbarui.',
      token,
      session_id: sid,
      expires_in: Math.floor(ttlMs / 1000),
      expires_at: expiresAtIso,
      session_policy: policy,
    });
  } catch (err) {
    console.error('Refresh mobile session error:', err);
    res.status(500).json({ success: false, message: 'Server error saat memperbarui sesi mobile.' });
  }
};

exports.revokeAdminSessions = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'ID admin tidak valid.' });
    }
    const target = await query.get('SELECT id FROM admins WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Akun admin tidak ditemukan.' });
    }
    await query.run(
      'UPDATE admins SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
      [id]
    );
    await query.run(
      "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'admin_revoked' WHERE admin_id = ? AND revoked_at IS NULL",
      [new Date().toISOString(), id]
    );
    res.json({ success: true, message: 'Semua sesi aktif akun tersebut berhasil dicabut.' });
  } catch (err) {
    console.error('Revoke admin sessions error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.listMobileSessions = async (req, res) => {
  try {
    const policy = await getMobileSessionPolicy();
    const rows = await query.all(
      `SELECT ms.session_id, ms.admin_id, ms.username, COALESCE(a.role, 'staff') AS role,
              ms.device_id, ms.device_name, ms.platform, ms.app_version, ms.ip_address,
              ms.created_at, ms.last_active_at, ms.expires_at, ms.revoked_at, ms.revoked_reason
       FROM mobile_sessions ms
       LEFT JOIN admins a ON a.id = ms.admin_id
       ORDER BY (ms.revoked_at IS NULL) DESC, ms.last_active_at DESC
       LIMIT 100`
    );

    const nowMs = Date.now();
    const idleLimitMs = policy.idle_timeout_minutes * 60 * 1000;
    const data = rows.map((r) => {
      const expiresMs = Date.parse(r.expires_at || '');
      const lastActiveMs = Date.parse(r.last_active_at || '');
      const isExpired = Number.isFinite(expiresMs) && nowMs > expiresMs;
      const isIdleExpired = Number.isFinite(lastActiveMs) && nowMs - lastActiveMs > idleLimitMs;
      let status = 'active';
      if (r.revoked_at) status = 'revoked';
      else if (isExpired) status = 'expired';
      else if (isIdleExpired) status = 'idle_expired';
      return {
        ...r,
        status,
        is_active: status === 'active',
      };
    });

    res.json({ success: true, data, policy });
  } catch (err) {
    console.error('List mobile sessions error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar sesi mobile.' });
  }
};

exports.revokeMobileSession = async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ success: false, message: 'ID sesi mobile tidak valid.' });
    }
    const existing = await query.get('SELECT session_id, revoked_at FROM mobile_sessions WHERE session_id = ?', [sessionId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sesi mobile tidak ditemukan.' });
    }
    if (!existing.revoked_at) {
      await query.run(
        "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'admin_revoked' WHERE session_id = ?",
        [new Date().toISOString(), sessionId]
      );
    }
    res.json({ success: true, message: 'Sesi perangkat mobile berhasil diputus.' });
  } catch (err) {
    console.error('Revoke mobile session error:', err);
    res.status(500).json({ success: false, message: 'Gagal mencabut sesi mobile.' });
  }
};

exports.revokeAllMobileSessions = async (req, res) => {
  try {
    const result = await query.run(
      "UPDATE mobile_sessions SET revoked_at = ?, revoked_reason = 'admin_revoked_all' WHERE revoked_at IS NULL",
      [new Date().toISOString()]
    );
    res.json({
      success: true,
      revoked_count: result.changes || 0,
      message: `Seluruh sesi mobile aktif (${result.changes || 0} perangkat) berhasil diputus.`,
    });
  } catch (err) {
    console.error('Revoke all mobile sessions error:', err);
    res.status(500).json({ success: false, message: 'Gagal mencabut seluruh sesi mobile.' });
  }
};
