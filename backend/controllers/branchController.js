const { query } = require('../db');

/**
 * Get all branches
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.getAllBranches = async (req, res) => {
  try {
    const branches = await query.all(`
      SELECT b.*,
        (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.status = 'Active') AS employee_count
      FROM branches b
      ORDER BY b.name ASC
    `);
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error('API Error (get branches):', error);
    res.status(500).json({ success: false, message: 'Server error loading branches' });
  }
};

/**
 * Create a new branch
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.createBranch = async (req, res) => {
  try {
    const { code, name, address, city, location_type, has_petshop, rent_amount } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Cabang wajib diisi.' });
    }
    const result = await query.run(
      'INSERT INTO branches (code, name, address, city, location_type, has_petshop, rent_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        code.trim().toUpperCase(), name.trim(), address || '', city || '',
        location_type || 'Konter',
        has_petshop ? 1 : 0,
        parseFloat(rent_amount) || 0,
      ]
    );
    const newBranch = await query.get('SELECT * FROM branches WHERE id = ?', [result.id]);
    res.json({ success: true, data: newBranch, message: 'Cabang berhasil ditambahkan.' });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Kode cabang sudah digunakan. Gunakan kode lain.' });
    }
    console.error('API Error (create branch):', error);
    res.status(500).json({ success: false, message: 'Server error creating branch' });
  }
};

/**
 * Delete a branch
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.deleteBranch = async (req, res) => {
  try {
    const branchId = parseInt(req.params.id);
    const activeEmployees = await query.get(
      "SELECT COUNT(*) as count FROM employees WHERE branch_id = ? AND status = 'Active'",
      [branchId]
    );
    if (activeEmployees.count > 0) {
      return res.status(400).json({ success: false, message: `Cabang memiliki ${activeEmployees.count} karyawan aktif. Pindahkan karyawan terlebih dahulu sebelum menghapus cabang.` });
    }
    await query.run('UPDATE candidates SET branch_id = NULL WHERE branch_id = ?', [branchId]);
    await query.run('UPDATE employees SET branch_id = NULL WHERE branch_id = ?', [branchId]);
    await query.run('DELETE FROM branches WHERE id = ?', [branchId]);
    res.json({ success: true, message: 'Cabang berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (delete branch):', error);
    res.status(500).json({ success: false, message: 'Server error deleting branch' });
  }
};

/**
 * Update a branch
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.updateBranch = async (req, res) => {
  try {
    const branchId = parseInt(req.params.id);
    const { code, name, address, city, status, location_type, has_petshop, rent_amount } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Cabang wajib diisi.' });
    }

    await query.run(
      'UPDATE branches SET code = ?, name = ?, address = ?, city = ?, status = ?, location_type = ?, has_petshop = ?, rent_amount = ? WHERE id = ?',
      [
        code.trim().toUpperCase(), name.trim(), address || '', city || '',
        status || 'Active',
        location_type || 'Konter',
        has_petshop ? 1 : 0,
        parseFloat(rent_amount) || 0,
        branchId,
      ]
    );
    const updatedBranch = await query.get('SELECT * FROM branches WHERE id = ?', [branchId]);
    res.json({ success: true, data: updatedBranch, message: 'Cabang berhasil diperbarui.' });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Kode cabang sudah digunakan. Gunakan kode lain.' });
    }
    console.error('API Error (update branch):', error);
    res.status(500).json({ success: false, message: 'Server error updating branch' });
  }
};
