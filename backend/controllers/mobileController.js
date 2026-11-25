const { query } = require('../db');
const {
  generateAccessCode,
  cleanupUploadedFiles,
  verifyImageMagicBytes
} = require('../utils/helpers');
const { EMPLOYEE_FIELDS, buildInsert } = require('../utils/candidateFields');
const { STAFF_ALL_FIELDS, buildInsert: buildStaffInsert } = require('../utils/staffFields');
const { haversineMeters, getPeriodForDate, getPeriodDateRange } = require('../utils/payrollCalc');
const {
  getSettings,
  getPenaltyRules,
  normalizeTimeHHMM,
  computeStatus,
  syncEmployeePeriod,
} = require('../utils/attendanceSync');

function safeParseJsonArray(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
 * 0. GET /api/mobile/health
 * Cek status server & versi API (Publik tanpa token — untuk verifikasi koneksi di layar Pengaturan HP)
 */
exports.health = (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    api_version: '2.0',
    server_time: new Date().toISOString(),
    features: ['offline_sync', 'geofence_checkin', 'leaves', 'overtime', 'reimbursements'],
  });
};

/**
 * 0b. GET /api/mobile/me
 * Verifikasi token JWT aktif & ambil profil beserta hak akses pengguna saat startup app
 */
exports.me = (req, res) => {
  const role = req.user?.role || 'staff';
  res.json({
    success: true,
    data: {
      id: req.user?.id,
      username: req.user?.username,
      role,
      permissions: {
        can_approve: ['finance', 'master'].includes(role),
        can_manage_loans: ['finance', 'master'].includes(role),
        can_manage_settings: role === 'master',
      },
    },
  });
};

/**
 * 1. GET /api/mobile/master-data
 * Mengambil data referensi untuk disimpan di cache lokal SQLite Flutter (Wajib Token)
 */
exports.getMasterData = async (req, res) => {
  try {
    const rawBranches = await query.all(
      "SELECT id, code, name, city, address, status, latitude, longitude, geofence_radius_m FROM branches WHERE status = 'Active' ORDER BY name ASC"
    );

    const branches = rawBranches.map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      address: b.address || '',
      city: b.city || '',
      phone: b.phone || '',
      status: b.status,
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      geofence_radius_m: b.geofence_radius_m ?? 100
    }));

    const leaveTypes = await query.all(
      'SELECT id, code, name, default_quota, is_paid, attendance_status, requires_attachment FROM leave_types WHERE is_active = 1 ORDER BY id ASC'
    );
    const settings = await getSettings();

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
        visit_purposes: ['Audit Rutin', 'Perbaikan/Maintenance', 'Stock Opname Aset', 'Kunjungan Darurat', 'Lainnya'],
        leave_types: leaveTypes,
        reimbursement_categories: ['Transportasi', 'Operasional Outlet', 'Kesehatan / Medis', 'Perlengkapan', 'Lainnya'],
        shift_cutoffs: {
          pagi: settings.shift_pagi_cutoff || '06:30',
          siang: settings.shift_siang_cutoff || '14:30',
        },
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
      ) VALUES (?, 'Penambahan', ?, NULL, ?, ?, NULL, ?, ?, ?, ?)`,
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

    const sClean = clampScore(score_cleanliness);
    const sSec = clampScore(score_security);
    const sDisp = clampScore(score_display);
    const sSop = clampScore(score_sop);
    const nonZeroScores = [sClean, sSec, sDisp, sSop].filter((n) => n > 0);
    const rawOverall = clampScore(overall_score);
    const finalOverall = rawOverall > 0
      ? rawOverall
      : (nonZeroScores.length > 0 ? Math.round(nonZeroScores.reduce((a, b) => a + b, 0) / nonZeroScores.length) : 0);

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
      sClean,
      sSec,
      sDisp,
      sSop,
      finalOverall,
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
      const empRow = await query.get('SELECT id FROM employees WHERE candidate_id = ?', [existing.id]);
      return res.status(200).json({
        success: true,
        message: 'Karyawan sudah tersinkronkan sebelumnya (idempotent).',
        data: {
          server_id: existing.id,
          candidate_id: existing.id,
          employee_id: empRow ? empRow.id : null,
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

    // Mirror to employees table so mobile-registered staff appear immediately in EmployeeManagement/Attendance/Payroll
    const staffPayload = {
      ...sanitizedBody,
      candidate_id: candidateId,
      contract_type: safeContract,
      salary: safeSalary,
      allowance: safeAllowance,
      hire_date: sanitizeText(hire_date, 20),
      employee_type: req.body.employee_type || 'Frontliner',
      position: req.body.position || 'Frontliner',
    };
    const { columns: sCols, placeholders: sPh, values: sVals } = buildStaffInsert(STAFF_ALL_FIELDS, staffPayload);
    let employeeId = null;
    try {
      const empInsert = await query.run(
        `INSERT INTO employees (${sCols}, candidate_id, status, created_at, updated_at)
         VALUES (${sPh}, ?, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [...sVals, candidateId]
      );
      employeeId = empInsert.id;
    } catch (err) {
      console.warn('[mobileController] Mirror insert into employees skipped:', err.message);
      const existingEmp = await query.get('SELECT id FROM employees WHERE candidate_id = ?', [candidateId]);
      employeeId = existingEmp ? existingEmp.id : null;
    }

    res.status(201).json({
      success: true,
      message: 'Karyawan berhasil terdaftar di sistem.',
      data: {
        server_id: candidateId,
        candidate_id: candidateId,
        employee_id: employeeId,
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

    const limitVal = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offsetVal = Math.max(0, parseInt(req.query.offset, 10) || 0);
    sql += ' ORDER BY a.id DESC LIMIT ? OFFSET ?';
    params.push(limitVal, offsetVal);

    const assets = await query.all(sql, params);
    res.json({
      success: true,
      data: assets.map(a => ({
        ...a,
        photos: safeParseJsonArray(a.photos)
      }))
    });
  } catch (error) {
    console.error('Mobile API Error (getAssets):', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data aset.' });
  }
};

/**
 * 7. GET /api/mobile/employees
 * Pencarian & daftar karyawan aktif per cabang untuk mobile (PII-Minimized: Tanpa NIK, Gaji, Rekening, atau Alamat KTP)
 */
exports.getEmployees = async (req, res) => {
  try {
    const { branch_id, search } = req.query;
    let sql = `
      SELECT e.id, c.client_uuid, c.access_code, e.name, e.gender, e.branch_id,
             e.hire_date, e.position, e.employee_type, b.name as branch_name, e.contract_type
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN candidates c ON e.candidate_id = c.id
      WHERE e.status = 'Active'
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND e.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (search && String(search).trim() !== '') {
      const q = `%${String(search).trim().slice(0, 100)}%`;
      sql += ' AND (e.name LIKE ? OR c.access_code LIKE ?)';
      params.push(q, q);
    }

    const limitVal = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offsetVal = Math.max(0, parseInt(req.query.offset, 10) || 0);
    sql += ' ORDER BY e.id DESC LIMIT ? OFFSET ?';
    params.push(limitVal, offsetVal);

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

/**
 * 8. POST /api/mobile/attendance/checkin
 * Check-in absensi mandiri dari mobile app dengan GPS Geofencing + Foto Selfie opsional
 */
exports.checkInAttendance = async (req, res) => {
  const uploadedFiles = req.file ? [req.file] : [];
  try {
    if (req.file && !verifyImageMagicBytes([req.file])) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'File foto selfie tidak valid.' });
    }

    const employeeId = parseInt(req.body.employee_id, 10);
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'employee_id wajib diisi.' });
    }

    const emp = await query.get(
      `SELECT e.id, e.name, e.branch_id, b.name AS branch_name, b.latitude AS branch_lat, b.longitude AS branch_lng, b.geofence_radius_m
       FROM employees e LEFT JOIN branches b ON e.branch_id = b.id
       WHERE e.id = ? AND e.status = 'Active'`,
      [employeeId]
    );
    if (!emp) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({ success: false, message: 'Karyawan aktif tidak ditemukan.' });
    }

    const lat = req.body.latitude !== undefined && req.body.latitude !== '' ? parseFloat(req.body.latitude) : null;
    const lng = req.body.longitude !== undefined && req.body.longitude !== '' ? parseFloat(req.body.longitude) : null;
    let distanceM = null;

    if (emp.branch_lat !== null && emp.branch_lat !== undefined && emp.branch_lng !== null && emp.branch_lng !== undefined) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        cleanupUploadedFiles(uploadedFiles);
        return res.status(400).json({ success: false, message: 'Koordinat GPS (latitude/longitude) wajib dikirim untuk cabang ini.' });
      }
      distanceM = haversineMeters(lat, lng, emp.branch_lat, emp.branch_lng);
      const maxRadius = emp.geofence_radius_m || 100;
      if (distanceM > maxRadius) {
        cleanupUploadedFiles(uploadedFiles);
        return res.status(400).json({
          success: false,
          code: 'OUTSIDE_GEOFENCE',
          distance_m: distanceM,
          max_radius_m: maxRadius,
          message: `Lokasi Anda berada ${distanceM} meter dari cabang ${emp.branch_name || ''} (batas maksimal ${maxRadius} meter).`,
        });
      }
    }

    const now = new Date();
    const dateStr = req.body.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
      ? req.body.date
      : getTodayDateStr();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const checkInTime = req.body.check_in_time
      ? (normalizeTimeHHMM(req.body.check_in_time) || currentHHMM)
      : currentHHMM;
    const shift = req.body.shift === 'Siang' ? 'Siang' : 'Pagi';
    const notes = sanitizeText(req.body.notes, 300);
    const photoFilename = req.file ? req.file.filename : null;

    const settings = await getSettings();
    const { status, is_late } = computeStatus(shift, checkInTime, settings);

    const existing = await query.get(
      'SELECT id FROM daily_attendance WHERE employee_id = ? AND date = ?',
      [employeeId, dateStr]
    );
    if (existing) {
      await query.run(
        `UPDATE daily_attendance
         SET shift=?, check_in_time=?, status=?, is_late=?, notes=COALESCE(?, notes),
             checkin_lat=?, checkin_lng=?, checkin_distance_m=?, checkin_photo=COALESCE(?, checkin_photo),
             updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [shift, checkInTime, status, is_late, notes, lat, lng, distanceM, photoFilename, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO daily_attendance
         (employee_id, date, shift, check_in_time, status, is_late, notes, checkin_lat, checkin_lng, checkin_distance_m, checkin_photo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [employeeId, dateStr, shift, checkInTime, status, is_late, notes, lat, lng, distanceM, photoFilename]
      );
    }

    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const period = getPeriodForDate(dateStr, startDay, endDay);
    const rules = await getPenaltyRules();
    await syncEmployeePeriod(employeeId, period, settings, rules);

    const saved = await query.get(
      'SELECT * FROM daily_attendance WHERE employee_id = ? AND date = ?',
      [employeeId, dateStr]
    );
    res.json({
      success: true,
      data: { ...saved, distance_m: distanceM },
      message: `Check-in berhasil (${status}${distanceM !== null ? ` · jarak ${distanceM}m` : ''}).`,
    });
  } catch (error) {
    cleanupUploadedFiles(uploadedFiles);
    console.error('Mobile API Error (checkInAttendance):', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan check-in absensi.' });
  }
};

/**
 * 9. GET /api/mobile/attendance/history?employee_id=&period=YYYY-MM
 * Riwayat absensi harian karyawan pada satu periode payroll untuk mobile
 */
exports.getAttendanceHistory = async (req, res) => {
  try {
    const employeeId = parseInt(req.query.employee_id, 10);
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ success: false, message: 'Parameter employee_id wajib berupa angka valid.' });
    }
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const period = req.query.period ? String(req.query.period).trim() : defaultPeriod;
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period wajib YYYY-MM.' });
    }

    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);

    const rows = await query.all(
      `SELECT id, employee_id, date, shift, check_in_time, status, is_late, notes,
              checkin_lat, checkin_lng, checkin_distance_m, checkin_photo
       FROM daily_attendance
       WHERE employee_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      [employeeId, startDate, endDate]
    );
    res.json({
      success: true,
      data: rows,
      period,
      period_range: { startDate, endDate },
    });
  } catch (error) {
    console.error('Mobile API Error (getAttendanceHistory):', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat absensi.' });
  }
};
