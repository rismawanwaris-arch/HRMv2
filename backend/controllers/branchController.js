const xlsx = require('xlsx');
const fs = require('fs');
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
function parseCoord(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

function parseRadius(val) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return 100;
  return Math.max(10, Math.min(10000, n));
}

exports.createBranch = async (req, res) => {
  try {
    const { code, name, address, city, location_type, has_petshop, rent_amount, latitude, longitude, geofence_radius_m } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Cabang wajib diisi.' });
    }
    const lat = parseCoord(latitude);
    const lng = parseCoord(longitude);
    const radius = parseRadius(geofence_radius_m);
    const result = await query.run(
      'INSERT INTO branches (code, name, address, city, location_type, has_petshop, rent_amount, latitude, longitude, geofence_radius_m) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        code.trim().toUpperCase(), name.trim(), address || '', city || '',
        location_type || 'Konter',
        has_petshop ? 1 : 0,
        parseFloat(rent_amount) || 0,
        lat,
        lng,
        radius,
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

function parseBranchRent(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw).trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, '');
  if (!s) return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  s = s.replace(/[^0-9.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Delete a branch
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.deleteBranch = async (req, res) => {
  try {
    const branchId = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT id FROM branches WHERE id = ?', [branchId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan.' });
    }

    const activeEmployees = await query.get(
      "SELECT COUNT(*) as count FROM employees WHERE branch_id = ? AND status = 'Active'",
      [branchId]
    );
    if (activeEmployees.count > 0) {
      return res.status(400).json({ success: false, message: `Cabang memiliki ${activeEmployees.count} karyawan aktif. Pindahkan karyawan terlebih dahulu sebelum menghapus cabang.` });
    }

    // Protect historical operational, asset, financial, and payroll records from FK crash or silent loss
    const refChecks = await Promise.all([
      query.get('SELECT COUNT(*) as c FROM outlet_visits WHERE branch_id = ?', [branchId]),
      query.get('SELECT COUNT(*) as c FROM outlet_incidents WHERE branch_id = ?', [branchId]),
      query.get('SELECT COUNT(*) as c FROM outlet_action_items WHERE branch_id = ?', [branchId]),
      query.get('SELECT COUNT(*) as c FROM outlet_assets WHERE branch_id = ?', [branchId]),
      query.get('SELECT COUNT(*) as c FROM outlet_asset_logs WHERE from_branch_id = ? OR to_branch_id = ?', [branchId, branchId]),
      query.get('SELECT COUNT(*) as c FROM payroll_entries WHERE branch_id = ?', [branchId]),
      query.get('SELECT COUNT(*) as c FROM outlet_financials WHERE branch_id = ?', [branchId]),
      query.get('SELECT COUNT(*) as c FROM warehouse_reports WHERE branch_id = ?', [branchId]),
    ]);
    const hasHistory = refChecks.some((r) => r && r.c > 0);
    if (hasHistory) {
      return res.status(400).json({
        success: false,
        message: 'Cabang memiliki riwayat operasional/aset/keuangan/payroll. Ubah status cabang menjadi Nonaktif agar data historis tidak hilang.'
      });
    }

    await query.run('BEGIN TRANSACTION');
    try {
      await query.run('UPDATE candidates SET branch_id = NULL WHERE branch_id = ?', [branchId]);
      await query.run('UPDATE employees SET branch_id = NULL WHERE branch_id = ?', [branchId]);
      await query.run('DELETE FROM branches WHERE id = ?', [branchId]);
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

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
    const branchId = parseInt(req.params.id, 10);
    const { code, name, address, city, status, location_type, has_petshop, rent_amount, latitude, longitude, geofence_radius_m } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama Cabang wajib diisi.' });
    }

    const existing = await query.get('SELECT id, latitude, longitude, geofence_radius_m FROM branches WHERE id = ?', [branchId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan.' });
    }

    const lat = latitude !== undefined ? parseCoord(latitude) : existing.latitude;
    const lng = longitude !== undefined ? parseCoord(longitude) : existing.longitude;
    const radius = geofence_radius_m !== undefined ? parseRadius(geofence_radius_m) : (existing.geofence_radius_m || 100);

    await query.run(
      'UPDATE branches SET code = ?, name = ?, address = ?, city = ?, status = ?, location_type = ?, has_petshop = ?, rent_amount = ?, latitude = ?, longitude = ?, geofence_radius_m = ? WHERE id = ?',
      [
        code.trim().toUpperCase(), name.trim(), address || '', city || '',
        status || 'Active',
        location_type || 'Konter',
        has_petshop ? 1 : 0,
        parseFloat(rent_amount) || 0,
        lat,
        lng,
        radius,
        branchId,
      ]
    );
    const updatedBranch = await query.get(
      `SELECT b.*,
        (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.status = 'Active') AS employee_count
       FROM branches b WHERE b.id = ?`,
      [branchId]
    );
    res.json({ success: true, data: updatedBranch, message: 'Cabang berhasil diperbarui.' });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Kode cabang sudah digunakan. Gunakan kode lain.' });
    }
    console.error('API Error (update branch):', error);
    res.status(500).json({ success: false, message: 'Server error updating branch' });
  }
};

exports.importBranches = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
    }
    let data;
    try {
      const workbook = xlsx.readFile(req.file.path);
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      data = xlsx.utils.sheet_to_json(ws, { defval: '' });
    } finally {
      if (fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    }
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'File Excel kosong.' });
    }
    let successCount = 0, errorCount = 0;
    const errors = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawCode = (row['Kode Cabang'] || row['Kode'] || '').toString().trim();
      const rawName = (row['Nama Cabang'] || row['Nama'] || '').toString().trim();
      // Skip blank separator rows or legacy template note rows (Keterangan:...)
      if (!rawCode && !rawName) continue;
      if (/^keterangan\b/i.test(rawCode) || /^(kode cabang|tipe|ada petshop|status|sewa\/bulan)\s*:/i.test(rawCode)) continue;

      const code = rawCode.toUpperCase();
      const name = rawName;
      if (!code || !name) { errors.push(`Baris ${i + 2}: Kode dan Nama wajib diisi.`); errorCount++; continue; }
      try {
        const locType = (row['Tipe'] || row['Tipe Lokasi'] || 'Konter').toString().trim();
        const hasPetshop = ['ya', 'yes', '1', 'true'].includes((row['Ada Petshop'] || '').toString().toLowerCase().trim()) ? 1 : 0;
        const rent = parseBranchRent(row['Sewa/Bulan'] || row['Biaya Sewa'] || '0');
        const city = (row['Kota'] || '').toString().trim();
        const address = (row['Alamat'] || '').toString().trim();
        const status = ['nonaktif', 'inactive', '0'].includes((row['Status'] || '').toString().toLowerCase().trim()) ? 'Inactive' : 'Active';
        const existing = await query.get('SELECT id FROM branches WHERE code = ?', [code]);
        if (existing) {
          await query.run('UPDATE branches SET name=?,address=?,city=?,location_type=?,has_petshop=?,rent_amount=?,status=? WHERE code=?',
            [name, address, city, locType, hasPetshop, rent, status, code]);
        } else {
          await query.run('INSERT INTO branches (code,name,address,city,location_type,has_petshop,rent_amount,status) VALUES (?,?,?,?,?,?,?,?)',
            [code, name, address, city, locType, hasPetshop, rent, status]);
        }
        successCount++;
      } catch (err) {
        errors.push(`Baris ${i + 2} (${code}): ${err.message}`);
        errorCount++;
      }
    }
    res.json({
      success: true,
      message: `Berhasil import ${successCount} cabang.${errorCount > 0 ? ` Gagal ${errorCount} baris.` : ''}`,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('API Error (import branches):', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ success: false, message: 'Server error mengimport data cabang.' });
  }
};

exports.downloadTemplate = (req, res) => {
  const headers = ['Kode Cabang', 'Nama Cabang', 'Tipe', 'Kota', 'Alamat', 'Sewa/Bulan', 'Ada Petshop', 'Status'];
  const example = ['JKT-01', 'Cabang Jakarta Pusat', 'Konter', 'Jakarta', 'Jl. Merdeka No.1, Jakarta Pusat', '5000000', 'Tidak', 'Aktif'];
  const notes = [['Keterangan:'], ['Kode Cabang: Kode unik (huruf kapital), cth: JKT-01, BDG-02'], ['Tipe: Konter, Gudang, atau Kantor/Pusat'], ['Ada Petshop: Ya atau Tidak'], ['Status: Aktif atau Nonaktif (jika kosong = Aktif)'], ['Sewa/Bulan: angka saja tanpa titik/koma']];
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 36 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  xlsx.utils.book_append_sheet(wb, ws, 'Template Cabang');
  const wsNotes = xlsx.utils.aoa_to_sheet(notes);
  wsNotes['!cols'] = [{ wch: 64 }];
  xlsx.utils.book_append_sheet(wb, wsNotes, 'Panduan');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="template_import_cabang.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};
