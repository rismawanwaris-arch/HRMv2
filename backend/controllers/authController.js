const { query } = require('../db');
const { verifyPassword, generateToken, hashPassword, needsRehash } = require('../utils/crypto');

const MIN_PASSWORD_LENGTH = 8;

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
      const mobileHours = Math.max(1, parseInt(process.env.MOBILE_TOKEN_TTL_HOURS || '12', 10) || 12);
      const ttlMs = isMobile ? mobileHours * 3600 * 1000 : 24 * 3600 * 1000;
      const tv = Number(admin.token_version || 1);
      const token = generateToken(admin.username, { role, tv, aud: isMobile ? 'mobile' : 'web' }, ttlMs);
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
    await query.run(
      'UPDATE admins SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, message: 'Logout berhasil. Semua sesi aktif akun ini telah dicabut.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Server error saat logout.' });
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
    res.json({ success: true, message: 'Semua sesi aktif akun tersebut berhasil dicabut.' });
  } catch (err) {
    console.error('Revoke admin sessions error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
