const { query } = require('../db');
const { generateAccessCode } = require('../utils/helpers');
const { EMPLOYEE_FIELDS, buildInsert } = require('../utils/candidateFields');
const { decryptRow, blindIndex } = require('../utils/fieldCrypto');

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 1. GET /api/mobile/master-data
 * Mengambil data referensi untuk disimpan di cache lokal SQLite Flutter
 */
exports.getMasterData = async (req, res) => {
  try {
    const branches = await query.all(
      'SELECT id, code, name, city, address, status FROM branches WHERE status = "Active" ORDER BY name ASC'
    );

    res.json({
      success: true,
      data: {
        branches,
        categories: ['Elektronik', 'Furniture', 'Peralatan', 'Kendaraan', 'Lainnya'],
        asset_conditions: ['Baik', 'Rusak Ringan', 'Rusak Berat'],
        asset_statuses: ['Aktif', 'Dalam Perbaikan', 'Dipensiunkan', 'Dimutasi'],
        contract_types: ['PKWT', 'PKWTT', 'Freelance', 'Magang'],
        incident_categories: ['Fasilitas', 'Kehilangan', 'Operasional', 'Lainnya'],
        incident_severities: ['Low', 'Medium', 'High', 'Critical'],
        incident_statuses: ['Open', 'In Progress', 'Resolved'],
        visit_purposes: ['Audit Rutin', 'Perbaikan/Maintenance', 'Stock Opname Aset', 'Kunjungan Darurat', 'Lainnya']
      }
    });
  } catch (error) {
    console.error('Mobile API Error (getMasterData):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat master data mobile.' });
  }
};

/**
 * 2. POST /api/mobile/sync/asset
 * Menerima input aset baru dari HP (Offline-First / Idempotent)
 */
exports.syncAsset = async (req, res) => {
  try {
    const {
      client_uuid,
      name,
      category,
      branch_id,
      asset_code,
      condition,
      status,
      brand,
      serial_number,
      vendor_supplier,
      purchase_date,
      purchase_cost,
      notes,
      created_at_client
    } = req.body;

    if (!client_uuid) {
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan.' });
    }

    if (!name || !category || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'Nama aset, kategori, dan cabang outlet wajib diisi.'
      });
    }

    // Cek idempotensi: apakah client_uuid ini sudah pernah tersinkron?
    const existing = await query.get('SELECT id, asset_code, client_uuid FROM outlet_assets WHERE client_uuid = ?', [client_uuid]);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Aset sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          client_uuid: existing.client_uuid,
          asset_code: existing.asset_code
        }
      });
    }

    // Generate asset_code jika tidak disediakan
    let finalCode = asset_code ? String(asset_code).trim() : '';
    if (!finalCode) {
      const branch = await query.get('SELECT code FROM branches WHERE id = ?', [branch_id]);
      const branchCode = branch?.code ? branch.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : 'OUT';
      const rand = generateAccessCode().slice(0, 4);
      finalCode = `AST-${branchCode}-${rand}`;
    }

    // Ambil foto yang diunggah
    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const date = purchase_date || getTodayDateStr();

    const insertSql = `
      INSERT INTO outlet_assets (
        client_uuid, asset_code, name, category, branch_id, purchase_date, purchase_cost,
        condition, status, brand, serial_number, vendor_supplier, photos, notes,
        client_created_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await query.run(insertSql, [
      client_uuid,
      finalCode,
      name.trim(),
      category,
      parseInt(branch_id, 10),
      date,
      parseFloat(purchase_cost) || 0,
      condition || 'Baik',
      status || 'Aktif',
      brand || null,
      serial_number || null,
      vendor_supplier || null,
      JSON.stringify(photosList),
      notes || null,
      created_at_client || new Date().toISOString()
    ]);

    const newAssetId = result.id;

    // Catat riwayat log penambahan aset awal
    await query.run(
      `INSERT INTO outlet_asset_logs (
        asset_id, log_type, log_date, from_branch_id, to_branch_id, cost,
        replacement_asset_name, reason, performed_by, photos, notes
      ) VALUES (?, 'PENAMBAHAN', ?, NULL, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        newAssetId,
        date,
        parseInt(branch_id, 10),
        parseFloat(purchase_cost) || 0,
        'Registrasi aset baru via aplikasi mobile Flutter',
        req.user?.username || 'Tim Lapangan GA',
        JSON.stringify(photosList),
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Aset berhasil disinkronkan.',
      data: {
        server_id: newAssetId,
        client_uuid,
        asset_code: finalCode
      }
    });
  } catch (error) {
    console.error('Mobile API Error (syncAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan aset: ' + error.message });
  }
};

/**
 * 3. POST /api/mobile/sync/visit
 * Menerima catatan kunjungan/audit outlet GA dari HP (Idempotent)
 */
exports.syncVisit = async (req, res) => {
  try {
    const {
      client_uuid,
      branch_id,
      visit_date,
      visit_time,
      visitor_name,
      purpose,
      score_cleanliness,
      score_security,
      score_display,
      score_sop,
      overall_score,
      notes,
      action_plan,
      staff_present,
      created_at_client
    } = req.body;

    if (!client_uuid) {
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan.' });
    }

    if (!branch_id || !visitor_name || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Cabang, nama pengunjung, dan tujuan kunjungan wajib diisi.'
      });
    }

    // Cek idempotensi
    const existing = await query.get('SELECT id, client_uuid FROM outlet_visits WHERE client_uuid = ?', [client_uuid]);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Kunjungan sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          client_uuid: existing.client_uuid
        }
      });
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const insertSql = `
      INSERT INTO outlet_visits (
        client_uuid, branch_id, visit_date, visit_time, visitor_name, purpose,
        status, score_cleanliness, score_security, score_display, score_sop, overall_score,
        notes, action_plan, staff_present, photos, client_created_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await query.run(insertSql, [
      client_uuid,
      parseInt(branch_id, 10),
      visit_date || getTodayDateStr(),
      visit_time || null,
      visitor_name.trim(),
      purpose.trim(),
      parseInt(score_cleanliness, 10) || 0,
      parseInt(score_security, 10) || 0,
      parseInt(score_display, 10) || 0,
      parseInt(score_sop, 10) || 0,
      parseInt(overall_score, 10) || 0,
      notes || null,
      action_plan || null,
      staff_present || null,
      JSON.stringify(photosList),
      created_at_client || new Date().toISOString()
    ]);

    res.status(201).json({
      success: true,
      message: 'Kunjungan berhasil disinkronkan.',
      data: {
        server_id: result.id,
        client_uuid
      }
    });
  } catch (error) {
    console.error('Mobile API Error (syncVisit):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan kunjungan: ' + error.message });
  }
};

/**
 * 4. POST /api/mobile/sync/incident
 * Menerima laporan insiden/kendala fasilitas cabang dari HP (Idempotent)
 */
exports.syncIncident = async (req, res) => {
  try {
    const {
      client_uuid,
      branch_id,
      incident_date,
      category,
      severity,
      title,
      description,
      action_taken,
      reported_by,
      status,
      created_at_client
    } = req.body;

    if (!client_uuid) {
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan.' });
    }

    if (!branch_id || !title || !description || !reported_by) {
      return res.status(400).json({
        success: false,
        message: 'Cabang, judul, deskripsi, dan nama pelapor wajib diisi.'
      });
    }

    const existing = await query.get('SELECT id, client_uuid FROM outlet_incidents WHERE client_uuid = ?', [client_uuid]);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Insiden sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          client_uuid: existing.client_uuid
        }
      });
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const insertSql = `
      INSERT INTO outlet_incidents (
        client_uuid, branch_id, incident_date, category, severity,
        title, description, action_taken, status, reported_by,
        photos, client_created_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await query.run(insertSql, [
      client_uuid,
      parseInt(branch_id, 10),
      incident_date || getTodayDateStr(),
      category || 'Fasilitas',
      severity || 'Medium',
      title.trim(),
      description.trim(),
      action_taken || null,
      status || 'Open',
      reported_by.trim(),
      JSON.stringify(photosList),
      created_at_client || new Date().toISOString()
    ]);

    res.status(201).json({
      success: true,
      message: 'Insiden berhasil disinkronkan.',
      data: {
        server_id: result.id,
        client_uuid
      }
    });
  } catch (error) {
    console.error('Mobile API Error (syncIncident):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan insiden: ' + error.message });
  }
};

/**
 * 5. POST /api/mobile/sync/employee
 * Pendaftaran karyawan baru manual langsung dari lapangan (Idempotent)
 */
exports.syncEmployee = async (req, res) => {
  try {
    const {
      client_uuid,
      contract_type,
      salary_offered,
      allowance,
      hire_date
    } = req.body;

    if (!client_uuid) {
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan.' });
    }

    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }

    // Cek idempotensi
    const existing = await query.get('SELECT id, access_code, client_uuid FROM candidates WHERE client_uuid = ?', [client_uuid]);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Karyawan sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          access_code: existing.access_code,
          client_uuid: existing.client_uuid
        }
      });
    }

    let accessCode;
    let codeExists = true;
    while (codeExists) {
      accessCode = generateAccessCode('MAN-');
      const found = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
      codeExists = !!found;
    }

    const { columns, placeholders, values } = buildInsert(EMPLOYEE_FIELDS, req.body);
    const candidateResult = await query.run(
      `INSERT INTO candidates (
        client_uuid, access_code, ${columns}, is_manual_entry, status, current_stage, synced_at, created_at, updated_at
      ) VALUES (?, ?, ${placeholders}, 1, 'Hired', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [client_uuid, accessCode, ...values]
    );

    const candidateId = candidateResult.id;

    await query.run(
      `INSERT OR REPLACE INTO stage7_offering 
        (candidate_id, contract_type, salary_offered, allowance, start_date, offering_status, passed)
       VALUES (?, ?, ?, ?, ?, 'Accepted', 1)`,
      [
        candidateId,
        contract_type || 'PKWT',
        salary_offered || 0,
        allowance || 0,
        hire_date || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Data karyawan berhasil disinkronkan.',
      data: {
        server_id: candidateId,
        access_code: accessCode,
        client_uuid
      }
    });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*(candidates\.nik|nik_bidx)/.test(error.message)) {
      return res.status(409).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    console.error('Mobile API Error (syncEmployee):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan data karyawan: ' + error.message });
  }
};

/**
 * 6. GET /api/mobile/assets
 * Pencarian & daftar aset cepat untuk mobile
 */
exports.getAssets = async (req, res) => {
  try {
    const { branch_id, category, search } = req.query;
    let sql = `
      SELECT a.id, a.client_uuid, a.asset_code, a.name, a.category, a.branch_id,
             a.condition, a.status, a.brand, a.serial_number, a.photos,
             b.name as branch_name, b.code as branch_code
      FROM outlet_assets a
      JOIN branches b ON a.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND a.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (category) {
      sql += ' AND a.category = ?';
      params.push(category);
    }
    if (search && search.trim() !== '') {
      sql += ' AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.serial_number LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY a.id DESC LIMIT 100';

    const assets = await query.all(sql, params);
    res.json({
      success: true,
      data: assets.map(a => ({
        ...a,
        photos: a.photos ? JSON.parse(a.photos) : []
      }))
    });
  } catch (error) {
    console.error('Mobile API Error (getAssets):', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data aset.' });
  }
};

/**
 * 7. GET /api/mobile/employees
 * Pencarian & daftar karyawan per cabang untuk mobile
 */
exports.getEmployees = async (req, res) => {
  try {
    const { branch_id, search } = req.query;
    let sql = `
      SELECT c.id, c.client_uuid, c.access_code, c.name, c.gender, c.phone, c.email, c.branch_id,
             c.hire_date, b.name as branch_name, s7.contract_type
      FROM candidates c
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN stage7_offering s7 ON c.id = s7.candidate_id
      WHERE c.status = 'Hired'
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND c.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (search && search.trim() !== '') {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY c.id DESC LIMIT 100';

    const employees = await query.all(sql, params);
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Mobile API Error (getEmployees):', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan.' });
  }
};
