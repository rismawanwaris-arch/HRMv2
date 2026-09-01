const { query } = require('../db');

const VALID_TYPES = ['Teguran Lisan', 'Teguran Tertulis', 'SP-1', 'SP-2', 'SP-3'];

exports.getAll = async (req, res) => {
  try {
    const { employee_id, status, type } = req.query;
    let sql = `
      SELECT d.*, e.name AS employee_name, e.employee_type, b.name AS branch_name
      FROM discipline_records d
      JOIN employees e ON e.id = d.employee_id
      LEFT JOIN branches b ON b.id = e.branch_id
      WHERE 1=1
    `;
    const params = [];
    if (employee_id) { sql += ' AND d.employee_id = ?'; params.push(parseInt(employee_id, 10)); }
    if (status)      { sql += ' AND d.status = ?';      params.push(status); }
    if (type)        { sql += ' AND d.type = ?';         params.push(type); }
    sql += ' ORDER BY d.date DESC, d.created_at DESC';
    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (discipline getAll):', err);
    res.status(500).json({ success: false, message: 'Server error memuat data disiplin.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { employee_id, type, date, description, issued_by } = req.body;
    if (!employee_id || !type || !date || !description) {
      return res.status(400).json({ success: false, message: 'Karyawan, tipe, tanggal, dan keterangan wajib diisi.' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipe sanksi tidak valid.' });
    }
    const emp = await query.get('SELECT id FROM employees WHERE id = ? AND status = ?', [parseInt(employee_id, 10), 'Active']);
    if (!emp) {
      return res.status(400).json({ success: false, message: 'Karyawan tidak ditemukan atau tidak aktif.' });
    }
    const result = await query.run(
      `INSERT INTO discipline_records (employee_id, type, date, description, issued_by, status)
       VALUES (?, ?, ?, ?, ?, 'Aktif')`,
      [parseInt(employee_id, 10), type, date, description.trim(), (issued_by || '').trim()]
    );
    const row = await query.get(
      `SELECT d.*, e.name AS employee_name, e.employee_type, b.name AS branch_name
       FROM discipline_records d
       JOIN employees e ON e.id = d.employee_id
       LEFT JOIN branches b ON b.id = e.branch_id
       WHERE d.id = ?`, [result.id]
    );
    res.json({ success: true, data: row, message: 'Catatan disiplin berhasil ditambahkan.' });
  } catch (err) {
    console.error('API Error (discipline create):', err);
    res.status(500).json({ success: false, message: 'Server error menyimpan catatan disiplin.' });
  }
};

exports.resolve = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { resolution_note } = req.body;
    if (!resolution_note || !resolution_note.trim()) {
      return res.status(400).json({ success: false, message: 'Catatan penyelesaian wajib diisi.' });
    }
    const rec = await query.get('SELECT id, status FROM discipline_records WHERE id = ?', [id]);
    if (!rec) return res.status(404).json({ success: false, message: 'Catatan tidak ditemukan.' });
    if (rec.status === 'Resolved') return res.status(400).json({ success: false, message: 'Catatan sudah diselesaikan.' });
    const today = new Date().toISOString().slice(0, 10);
    await query.run(
      `UPDATE discipline_records SET status='Resolved', resolution_note=?, resolved_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [resolution_note.trim(), today, id]
    );
    const row = await query.get(
      `SELECT d.*, e.name AS employee_name, e.employee_type, b.name AS branch_name
       FROM discipline_records d
       JOIN employees e ON e.id = d.employee_id
       LEFT JOIN branches b ON b.id = e.branch_id
       WHERE d.id = ?`, [id]
    );
    res.json({ success: true, data: row, message: 'Sanksi berhasil diselesaikan.' });
  } catch (err) {
    console.error('API Error (discipline resolve):', err);
    res.status(500).json({ success: false, message: 'Server error menyelesaikan sanksi.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rec = await query.get('SELECT id FROM discipline_records WHERE id = ?', [id]);
    if (!rec) return res.status(404).json({ success: false, message: 'Catatan tidak ditemukan.' });
    await query.run('DELETE FROM discipline_records WHERE id = ?', [id]);
    res.json({ success: true, message: 'Catatan disiplin dihapus.' });
  } catch (err) {
    console.error('API Error (discipline remove):', err);
    res.status(500).json({ success: false, message: 'Server error menghapus catatan.' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const rows = await query.all(`
      SELECT type, status, COUNT(*) as count
      FROM discipline_records
      GROUP BY type, status
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (discipline stats):', err);
    res.status(500).json({ success: false, message: 'Server error memuat statistik.' });
  }
};
