const { query } = require('../db');
const {
  generateAccessCode,
  cleanupUploadedFiles,
  verifyImageMagicBytes
} = require('../utils/helpers');
const { EMPLOYEE_FIELDS, buildInsert } = require('../utils/candidateFields');

const CLIENT_UUID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

const VALID_CATEGORIES = ['Elektronik', 'Furniture', 'Peralatan', 'Kendaraan', 'Lainnya', 'Elektronik & HP'];
const VALID_CONDITIONS = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
const VALID_STATUSES = ['Aktif', 'Dalam Perbaikan', 'Dipensiunkan', 'Dimutasi'];
const VALID_CONTRACT_TYPES = ['PKWT', 'PKWTT', 'Freelance', 'Magang'];
const VALID_INCIDENT_CATEGORIES = ['Fasilitas', 'Kehilangan', 'Operasional', 'Lainnya'];
const VALID_INCIDENT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const VALID_INCIDENT_STATUSES = ['Open', 'In Progress', 'Resolved'];

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidClientUuid(uuid) {
  return typeof uuid === 'string' && CLIENT_UUID_REGEX.test(uuid.trim());
}

function sanitizeText(val, maxLen = 500) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function clampScore(val) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function clampPositiveMoney(val, maxVal = 1000000000) {
  const n = parseFloat(val);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, maxVal);
}

/**
 * 1. GET /api/mobile/master-data
 * Mengambil data referensi untuk disimpan di cache lokal SQLite Flutter (Wajib Token)
 */
exports.getMasterData = async (req, res) => {
  try {
    const rawBranches = await query.all(
      'SELECT id, code, name, city, address, status FROM branches WHERE status = "Active" ORDER BY name ASC'
    );

    const branches = rawBranches.map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      address: b.address || '',
      city: b.city || '',
      phone: b.phone || '',
      status: b.status
    }));

    res.json({
      success: true,
      data: {
        branches,
        categories: ['Elektronik', 'Furniture', 'Peralatan', 'Kendaraan', 'Lainnya'],
        asset_conditions: VALID_CONDITIONS,
        asset_statuses: VALID_STATUSES,
        contract_types: VALID_CONTRACT_TYPES,
        incident_categories: VALID_INCIDENT_CATEGORIES,
        incident_severities: VALID_INCIDENT_SEVERITIES,
        incident_statuses: VALID_INCIDENT_STATUSES,
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

    if (!isValidClientUuid(client_uuid)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan dengan format yang valid.' });
    }

    const cleanUuid = client_uuid.trim();
    const cleanName = sanitizeText(name, 200);
    const cleanCategory = sanitizeText(category, 100);
    const branchIdInt = parseInt(branch_id, 10);

    if (!cleanName || !cleanCategory || Number.isNaN(branchIdInt) || branchIdInt < 1) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Nama aset, kategori, dan cabang outlet wajib diisi.'
      });
    }

    // Validasi magic bytes foto jika ada file yang diunggah
    if (req.files && req.files.length > 0 && !verifyImageMagicBytes(req.files)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'File foto tidak valid atau terdeteksi bukan gambar asli (JPG/PNG/WEBP).'
      });
    }

    // Cek idempotensi: apakah client_uuid ini sudah pernah tersinkron?
    const existing = await query.get(
      'SELECT id, asset_code, client_uuid FROM outlet_assets WHERE client_uuid = ?',
      [cleanUuid]
    );
    if (existing) {
      // Hapus file duplikat yang baru diupload agar tidak mengotori disk
      cleanupUploadedFiles(req.files);
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

    // Pastikan cabang benar-benar ada di database (mencegah FK error)
    const branch = await query.get('SELECT id, code FROM branches WHERE id = ?', [branchIdInt]);
    if (!branch) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'Cabang outlet tidak ditemukan.' });
    }

    // Generate asset_code jika tidak disediakan
    let finalCode = sanitizeText(asset_code, 64);
    if (!finalCode) {
      const branchCode = branch.code ? branch.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : 'OUT';
      const rand = generateAccessCode().slice(0, 4);
      finalCode = `AST-${branchCode}-${rand}`;
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const safeCondition = VALID_CONDITIONS.includes(condition) ? condition : 'Baik';
    const safeStatus = VALID_STATUSES.includes(status) ? status : 'Aktif';
    const safeCost = clampPositiveMoney(purchase_cost);
    const date = sanitizeText(purchase_date, 20) || getTodayDateStr();

    const insertSql = `
      INSERT INTO outlet_assets (
        client_uuid, asset_code, name, category, branch_id, purchase_date, purchase_cost,
        condition, status, brand, serial_number, vendor_supplier, photos, notes,
        client_created_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await query.run(insertSql, [
      cleanUuid,
      finalCode,
      cleanName,
      cleanCategory,
      branchIdInt,
      date,
      safeCost,
      safeCondition,
      safeStatus,
      sanitizeText(brand, 100),
      sanitizeText(serial_number, 100),
      sanitizeText(vendor_supplier, 150),
      JSON.stringify(photosList),
      sanitizeText(notes, 1000),
      sanitizeText(created_at_client, 40) || new Date().toISOString()
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
        branchIdInt,
        safeCost,
        'Registrasi aset baru via aplikasi mobile Flutter',
        req.user?.username || 'Tim Lapangan GA',
        JSON.stringify(photosList),
        sanitizeText(notes, 1000)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Aset berhasil disinkronkan ke server.',
      data: {
        server_id: newAssetId,
        client_uuid: cleanUuid,
        asset_code: finalCode
      }
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    if (error.message && error.message.includes('UNIQUE constraint failed: outlet_assets.asset_code')) {
      return res.status(409).json({ success: false, message: 'Kode aset (asset_code) sudah terdaftar di sistem.' });
    }
    console.error('Mobile API Error (syncAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan data aset ke server.' });
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

    if (!isValidClientUuid(client_uuid)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan dengan format yang valid.' });
    }

    const cleanUuid = client_uuid.trim();
    const branchIdInt = parseInt(branch_id, 10);
    const cleanVisitor = sanitizeText(visitor_name, 150);
    const cleanPurpose = sanitizeText(purpose, 200);

    if (Number.isNaN(branchIdInt) || branchIdInt < 1 || !cleanVisitor || !cleanPurpose) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Cabang, nama pengunjung, dan tujuan kunjungan wajib diisi.'
      });
    }

    if (req.files && req.files.length > 0 && !verifyImageMagicBytes(req.files)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'File foto tidak valid atau terdeteksi bukan gambar asli (JPG/PNG/WEBP).'
      });
    }

    // Cek idempotensi
    const existing = await query.get('SELECT id, client_uuid FROM outlet_visits WHERE client_uuid = ?', [cleanUuid]);
    if (existing) {
      cleanupUploadedFiles(req.files);
      return res.status(200).json({
        success: true,
        message: 'Kunjungan sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          client_uuid: existing.client_uuid
        }
      });
    }

    const branch = await query.get('SELECT id FROM branches WHERE id = ?', [branchIdInt]);
    if (!branch) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'Cabang outlet tidak ditemukan.' });
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
      cleanUuid,
      branchIdInt,
      sanitizeText(visit_date, 20) || getTodayDateStr(),
      sanitizeText(visit_time, 10),
      cleanVisitor,
      cleanPurpose,
      clampScore(score_cleanliness),
      clampScore(score_security),
      clampScore(score_display),
      clampScore(score_sop),
      clampScore(overall_score),
      sanitizeText(notes, 1000),
      sanitizeText(action_plan, 1000),
      sanitizeText(staff_present, 500),
      JSON.stringify(photosList),
      sanitizeText(created_at_client, 40) || new Date().toISOString()
    ]);

    res.status(201).json({
      success: true,
      message: 'Data kunjungan audit berhasil disimpan.',
      data: {
        server_id: result.id,
        client_uuid: cleanUuid
      }
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error('Mobile API Error (syncVisit):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan data kunjungan ke server.' });
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

    if (!isValidClientUuid(client_uuid)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan dengan format yang valid.' });
    }

    const cleanUuid = client_uuid.trim();
    const branchIdInt = parseInt(branch_id, 10);
    const cleanTitle = sanitizeText(title, 200);
    const cleanDesc = sanitizeText(description, 2000);
    const cleanReporter = sanitizeText(reported_by, 150);

    if (Number.isNaN(branchIdInt) || branchIdInt < 1 || !cleanTitle || !cleanDesc || !cleanReporter) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Cabang, judul, deskripsi, dan nama pelapor wajib diisi.'
      });
    }

    if (req.files && req.files.length > 0 && !verifyImageMagicBytes(req.files)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'File foto tidak valid atau terdeteksi bukan gambar asli (JPG/PNG/WEBP).'
      });
    }

    const existing = await query.get('SELECT id, client_uuid FROM outlet_incidents WHERE client_uuid = ?', [cleanUuid]);
    if (existing) {
      cleanupUploadedFiles(req.files);
      return res.status(200).json({
        success: true,
        message: 'Insiden sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          client_uuid: existing.client_uuid
        }
      });
    }

    const branch = await query.get('SELECT id FROM branches WHERE id = ?', [branchIdInt]);
    if (!branch) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'Cabang outlet tidak ditemukan.' });
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const safeCategory = VALID_INCIDENT_CATEGORIES.includes(category) ? category : 'Fasilitas';
    const safeSeverity = VALID_INCIDENT_SEVERITIES.includes(severity) ? severity : 'Medium';
    const safeStatus = VALID_INCIDENT_STATUSES.includes(status) ? status : 'Open';

    const insertSql = `
      INSERT INTO outlet_incidents (
        client_uuid, branch_id, incident_date, category, severity,
        title, description, action_taken, status, reported_by,
        photos, client_created_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await query.run(insertSql, [
      cleanUuid,
      branchIdInt,
      sanitizeText(incident_date, 20) || getTodayDateStr(),
      safeCategory,
      safeSeverity,
      cleanTitle,
      cleanDesc,
      sanitizeText(action_taken, 1000),
      safeStatus,
      cleanReporter,
      JSON.stringify(photosList),
      sanitizeText(created_at_client, 40) || new Date().toISOString()
    ]);

    res.status(201).json({
      success: true,
      message: 'Laporan insiden berhasil diterima.',
      data: {
        server_id: result.id,
        client_uuid: cleanUuid
      }
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error('Mobile API Error (syncIncident):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan laporan insiden ke server.' });
  }
};

/**
 * 5. POST /api/mobile/sync/employee
 * Pendaftaran karyawan baru manual langsung dari lapangan (Idempotent + PII Encrypted at Rest)
 */
exports.syncEmployee = async (req, res) => {
  try {
    const {
      client_uuid,
      contract_type,
      salary_offered,
      allowance,
      hire_date,
      branch_id
    } = req.body;

    if (!isValidClientUuid(client_uuid)) {
      return res.status(400).json({ success: false, message: 'client_uuid wajib disertakan dengan format yang valid.' });
    }

    const cleanUuid = client_uuid.trim();
    const cleanName = sanitizeText(req.body.name, 150);

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }

    // Validasi NIK jika diisi (wajib angka 16 digit untuk standar KTP Indonesia)
    if (req.body.nik !== undefined && req.body.nik !== null && String(req.body.nik).trim() !== '') {
      const nikStr = String(req.body.nik).trim();
      if (!/^\d{8,20}$/.test(nikStr)) {
        return res.status(400).json({ success: false, message: 'Format NIK tidak valid (harus berupa angka 8-20 digit).' });
      }
    }

    // Cek idempotensi
    const existing = await query.get(
      'SELECT id, access_code, client_uuid FROM candidates WHERE client_uuid = ?',
      [cleanUuid]
    );
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

    // Validasi branch_id jika disertakan
    let validBranchId = null;
    if (branch_id !== undefined && branch_id !== null && String(branch_id).trim() !== '') {
      const parsedBranch = parseInt(branch_id, 10);
      if (Number.isNaN(parsedBranch) || parsedBranch < 1) {
        return res.status(400).json({ success: false, message: 'ID cabang tidak valid.' });
      }
      const branch = await query.get('SELECT id FROM branches WHERE id = ?', [parsedBranch]);
      if (!branch) {
        return res.status(400).json({ success: false, message: 'Cabang outlet tidak ditemukan.' });
      }
      validBranchId = parsedBranch;
    }

    let accessCode;
    let codeExists = true;
    while (codeExists) {
      accessCode = generateAccessCode('MAN-');
      const found = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
      codeExists = !!found;
    }

    const sanitizedBody = {
      ...req.body,
      name: cleanName,
      branch_id: validBranchId
    };

    // buildInsert secara otomatis mengenkripsi kolom PII sensitif (NIK, NPWP, Bank, BPJS) menggunakan AES-256-GCM
    const { columns, placeholders, values } = buildInsert(EMPLOYEE_FIELDS, sanitizedBody);
    const candidateResult = await query.run(
      `INSERT INTO candidates (
        client_uuid, access_code, ${columns}, is_manual_entry, status, current_stage, synced_at, created_at, updated_at
      ) VALUES (?, ?, ${placeholders}, 1, 'Hired', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [cleanUuid, accessCode, ...values]
    );

    const candidateId = candidateResult.id;
    const safeContract = VALID_CONTRACT_TYPES.includes(contract_type) ? contract_type : 'PKWT';
    const safeSalary = clampPositiveMoney(salary_offered, 100000000);
    const safeAllowance = clampPositiveMoney(allowance, 50000000);

    await query.run(
      `INSERT OR REPLACE INTO stage7_offering 
        (candidate_id, contract_type, salary_offered, allowance, start_date, offering_status, passed)
       VALUES (?, ?, ?, ?, ?, 'Accepted', 1)`,
      [
        candidateId,
        safeContract,
        safeSalary,
        safeAllowance,
        sanitizeText(hire_date, 20)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Karyawan berhasil terdaftar di sistem.',
      data: {
        server_id: candidateId,
        access_code: accessCode,
        client_uuid: cleanUuid
      }
    });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*(candidates\.nik|nik_bidx)/.test(error.message)) {
      return res.status(409).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    console.error('Mobile API Error (syncEmployee):', error);
    res.status(500).json({ success: false, message: 'Gagal menyinkronkan data karyawan ke server.' });
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
      params.push(String(category).trim());
    }
    if (search && String(search).trim() !== '') {
      const q = `%${String(search).trim().slice(0, 100)}%`;
      sql += ' AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.serial_number LIKE ?)';
      params.push(q, q, q);
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
 * Pencarian & daftar karyawan per cabang untuk mobile (PII-Minimized: Tanpa NIK, Gaji, Rekening, atau Alamat KTP)
 */
exports.getEmployees = async (req, res) => {
  try {
    const { branch_id, search } = req.query;
    let sql = `
      SELECT c.id, c.client_uuid, c.access_code, c.name, c.gender, c.branch_id,
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
    if (search && String(search).trim() !== '') {
      const q = `%${String(search).trim().slice(0, 100)}%`;
      sql += ' AND (c.name LIKE ? OR c.access_code LIKE ?)';
      params.push(q, q);
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
