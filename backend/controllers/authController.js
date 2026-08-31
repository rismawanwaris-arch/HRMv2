const { query } = require('../db');
const { verifyPassword, generateToken, hashPassword } = require('../utils/crypto');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await query.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (admin && verifyPassword(password, admin.password)) {
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
    const { username, oldPassword, newPassword } = req.body;
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
