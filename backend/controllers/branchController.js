const { query } = require('../db');

/**
 * Get all branches
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.getAllBranches = async (req, res) => {
  try {
    const branches = await query.all('SELECT * FROM branches ORDER BY name ASC');
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
    const { code, name, address, city } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Cabang wajib diisi.' });
    }
    const result = await query.run(
      'INSERT INTO branches (code, name, address, city) VALUES (?, ?, ?, ?)',
      [code.trim().toUpperCase(), name.trim(), address || '', city || '']
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
    // Unassign employees from this branch before deleting
    await query.run('UPDATE candidates SET branch_id = NULL WHERE branch_id = ?', [branchId]);
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
    const { code, name, address, city, status } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Cabang wajib diisi.' });
    }
    
    // Default status to 'Active' if not provided
    const branchStatus = status || 'Active';

    await query.run(
      'UPDATE branches SET code = ?, name = ?, address = ?, city = ?, status = ? WHERE id = ?',
      [code.trim().toUpperCase(), name.trim(), address || '', city || '', branchStatus, branchId]
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
