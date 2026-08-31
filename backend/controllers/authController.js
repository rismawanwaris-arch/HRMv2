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
      const token = generateToken(admin.username);
      res.json({ success: true, token, username: admin.username });
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
      await query.run('UPDATE admins SET password = ? WHERE id = ?', [hashed, admin.id]);
      res.json({ success: true, message: 'Password berhasil diubah.' });
    } else {
      res.status(401).json({ success: false, message: 'Password lama tidak cocok.' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error saat mengganti password.' });
  }
};
