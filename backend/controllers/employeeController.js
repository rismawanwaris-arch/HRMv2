const xlsx = require('xlsx');
const fs = require('fs');
const { query } = require('../db');
const { generateAccessCode } = require('../utils/helpers');
const { EMPLOYEE_FIELDS, buildInsert, buildUpdate } = require('../utils/candidateFields');
const { STAFF_ALL_FIELDS, buildInsert: buildStaffInsert, buildUpdate: buildStaffUpdate } = require('../utils/staffFields');
const { decryptRow, blindIndex } = require('../utils/fieldCrypto');

/**
 * Get list of Hired Employees (Data Karyawan)
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.getEmployees = async (req, res) => {
  try {
    const { search, contract_type, branch_id } = req.query;
    
    let sql = `
      SELECT c.*, 
             s7.contract_type, s7.salary_offered, s7.allowance, s7.start_date, s7.offering_status,
             ob.day_30_status, ob.day_60_status, ob.day_90_status, ob.kpi_akurasi_transaksi, ob.kpi_kehadiran,
             b.name AS branch_name, b.code AS branch_code, b.city AS branch_city
      FROM candidates c
      LEFT JOIN stage7_offering s7 ON c.id = s7.candidate_id
      LEFT JOIN onboarding ob ON c.id = ob.candidate_id
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.status = 'Hired'
    `;
    const params = [];

    if (search) {
      sql += ' AND (c.name LIKE ? OR c.nik LIKE ? OR c.nik_bidx = ? OR c.phone LIKE ? OR b.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, blindIndex(search), `%${search}%`, `%${search}%`);
    }
    if (contract_type) {
      sql += ' AND s7.contract_type = ?';
      params.push(contract_type);
    }
    if (branch_id) {
      sql += ' AND c.branch_id = ?';
      params.push(parseInt(String(branch_id), 10));
    }

    sql += ' ORDER BY c.id DESC';

    const employees = await query.all(sql, params);
    for (const e of employees) { decryptRow(e); delete e.nik_bidx; }
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('API Error (employees list):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving employees: ' + error.message });
  }
};

/**
 * Add a new employee manually (karyawan lama)
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.addEmployeeManual = async (req, res) => {
  try {
    const { contract_type, salary_offered, allowance, hire_date } = req.body;

    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }

    let accessCode;
    let codeExists = true;
    while (codeExists) {
      accessCode = generateAccessCode('MAN-');
      const existing = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
      codeExists = !!existing;
    }

    const { columns, placeholders, values } = buildInsert(EMPLOYEE_FIELDS, req.body);
    const candidateResult = await query.run(
      `INSERT INTO candidates (access_code, ${columns}, is_manual_entry, status, current_stage, created_at, updated_at)
       VALUES (?, ${placeholders}, 1, 'Hired', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [accessCode, ...values]
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

    res.json({
      success: true,
      message: `Karyawan "${req.body.name.trim()}" berhasil ditambahkan ke Data Karyawan.`,
      candidateId
    });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*(candidates\.nik|nik_bidx)/.test(error.message)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    console.error('API Error (manual employee):', error);
    res.status(500).json({ success: false, message: 'Server error adding employee manually' });
  }
};

/**
 * Update employee data
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.updateEmployee = async (req, res) => {
  try {
    const employeeId = parseInt(String(req.params.id), 10);
    const { contract_type, salary_offered, allowance, hire_date } = req.body;

    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }

    const existing = await query.get('SELECT id FROM candidates WHERE id = ?', [employeeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    }

    const { assignments, values } = buildUpdate(EMPLOYEE_FIELDS, req.body);
    await query.run(
      `UPDATE candidates SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, employeeId]
    );

    await query.run(
      `UPDATE stage7_offering 
       SET contract_type = ?, salary_offered = ?, allowance = ?, start_date = ?
       WHERE candidate_id = ?`,
      [
        contract_type || 'PKWT',
        salary_offered || 0,
        allowance || 0,
        hire_date || null,
        employeeId
      ]
    );

    res.json({ success: true, message: 'Data karyawan berhasil diperbarui.' });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*(candidates\.nik|nik_bidx)/.test(error.message)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    console.error('API Error (update employee):', error);
    res.status(500).json({ success: false, message: 'Server error updating employee' });
  }
};


/**
 * Import employees from Excel file
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.importExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
    }

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    // Hapus file temporary setelah dibaca
    fs.unlinkSync(filePath);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'File Excel kosong.' });
    }

    // Ambil data cabang untuk pencocokan
    const branches = await query.all('SELECT id, code, name FROM branches');
    const branchMap = {};
    const branchCodes = new Set();
    branches.forEach(b => {
      branchMap[b.name.toLowerCase().trim()] = b.id;
      if (b.code) branchCodes.add(b.code.toUpperCase().trim());
    });

    const getOrCreateBranchId = async (rawBranchName) => {
      const cleanName = (rawBranchName || '').toString().trim();
      if (!cleanName) return null;
      const key = cleanName.toLowerCase();
      if (branchMap[key]) return branchMap[key];

      // Auto-generate kode cabang unik jika belum terdaftar di master cabang
      let baseCode = cleanName
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .map(w => w.slice(0, 4))
        .join('-')
        .slice(0, 12) || 'CBG';
      let code = baseCode;
      let seq = 1;
      while (branchCodes.has(code)) {
        seq++;
        code = `${baseCode}-${seq}`;
      }
      branchCodes.add(code);

      const hasPetshop = /petshop/i.test(cleanName) ? 1 : 0;
      const locType = /^(admin|cs|gudang|ho|head office)$/i.test(cleanName) ? 'Kantor/Pusat' : 'Konter';
      const ins = await query.run(
        'INSERT INTO branches (code, name, address, city, location_type, has_petshop, rent_amount, status) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        [code, cleanName, '', 'Bandung', locType, hasPetshop, 'Active']
      );
      branchMap[key] = ins.id;
      return ins.id;
    };

    let successCount = 0;
    let errorCount = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const name = (row['Nama Lengkap'] || row['Nama'] || row['Employee Name'] || '').toString().trim();
        if (!name) continue; // Skip baris kosong

        const str = (key) => (row[key] !== undefined && row[key] !== null ? row[key] : '').toString().trim();

        // Parsing Tempat & Tanggal Lahir (mendukung kolom terpisah maupun gabungan)
        let birth_place = str('Tempat Lahir');
        let birth_date = str('Tanggal Lahir') || str('Date of Birth');
        const ttl = str('Tempat & Tanggal Lahir');
        if (!birth_place && !birth_date && ttl) {
          const parts = ttl.split(',');
          if (parts.length > 1) {
            birth_place = parts[0].trim();
            birth_date = parts.slice(1).join(',').trim();
          } else {
            birth_place = ttl.trim();
          }
        }

        // Parsing Bank & Rekening
        let bank_name = str('Nama Bank');
        let bank_account = str('Nomor Rekening') || str('Rek BCA');
        const bankInfo = str('Nama Bank & Nomor Rekening');
        if (bankInfo) {
          const parts = bankInfo.split(/\s*-\s*|\s+/);
          if (parts.length > 1) {
            bank_name = parts[0].trim();
            bank_account = parts.slice(1).join(' ').trim();
          } else if (/^\d+$/.test(bankInfo)) {
            bank_name = 'BCA';
            bank_account = bankInfo;
          } else {
            bank_name = bankInfo;
          }
        } else if (bank_account && !bank_name) {
          bank_name = 'BCA';
        }

        // Parsing Cabang (auto-match atau auto-create jika belum ada)
        const rawBranch = str('Cabang Penempatan') || str('Departement') || str('Cabang');
        const branch_id = await getOrCreateBranchId(rawBranch);

        const phone = str('No. Handphone') || str('No. Telephone') || str('Phone');
        let nik = str('NIK') || str('Nomor KTP') || str('KTP');
        if (!nik) nik = null;

        const position = str('Jabatan') || str('Posisi') || 'Frontliner';
        const rawEmpType = str('Tipe Karyawan');
        const employee_type = rawEmpType
          ? (rawEmpType.toLowerCase() === 'staff' ? 'Staff' : 'Frontliner')
          : (/^(admin|admin setoran|cs|hr|finance|spv|supervisor|manager)$/i.test(position) ? 'Staff' : 'Frontliner');
        const contract_type = str('Tipe Kontrak') || 'PKWT';
        const hire_date = str('Tanggal Diterima') || str('Joining Date') || null;
        const address_ktp = str('Alamat KTP') || str('Permanent Address');
        const address_domicile = str('Alamat Domisili') || address_ktp;

        const rowBody = {
          name,
          nik,
          gender: str('Jenis Kelamin') || str('Gender'),
          birth_place,
          birth_date,
          religion: str('Agama') || str('Religion'),
          marital_status: str('Status Perkawinan') || str('Marital Status'),
          dependents: parseInt(row['Jumlah Tanggungan']) || 0,
          blood_type: str('Golongan Darah'),
          phone,
          email: str('E-mail') || str('Email'),
          address_ktp,
          address_domicile,
          emergency_contact_1: str('Kontak Darurat 1 (Nama & No HP)') || str('Emergency Contact Person & Number'),
          emergency_contact_2: str('Kontak Darurat 2 (Nama & No HP)'),
          father_name: str('Nama Ayah') || str("Father's Name"),
          mother_name: str('Nama Ibu') || str("Mother's Name"),
          spouse_name: str('Nama Pasangan (Jika ada)'),
          education_level: str('Pendidikan Terakhir'),
          education_institution: str('Nama Institusi Pendidikan'),
          education_major: str('Jurusan'),
          education_years: str('Tahun Lulus'),
          education_grade: str('Nilai / IPK'),
          height: parseInt(row['Tinggi Badan (cm)']) || null,
          weight: parseInt(row['Berat Badan (kg)']) || null,
          physical_condition: str('Kondisi Fisik'),
          color_blind_test: str('Tes Buta Warna'),
          health_history: str('Riwayat Penyakit'),
          allergies: str('Alergi'),
          npwp: str('Nomor NPWP'),
          bank_name,
          bank_account,
          bpjs_health: str('Nomor BPJS Kesehatan'),
          bpjs_employment: str('Nomor BPJS Ketenagakerjaan'),
          uniform_size: str('Ukuran Seragam'),
          branch_id,
          hire_date,
          position,
          employee_type,
          contract_type,
          salary: parseFloat(row['Gaji Pokok']) || 0,
          allowance: parseFloat(row['Tunjangan']) || 0,
        };

        // 1. Upsert ke tabel candidates (Data Karyawan Rekrutmen)
        let candidateId = null;
        if (nik) {
          const bidx = blindIndex(nik);
          const existingCand = bidx
            ? await query.get('SELECT id FROM candidates WHERE nik_bidx = ? OR nik = ?', [bidx, nik])
            : await query.get('SELECT id FROM candidates WHERE nik = ?', [nik]);
          if (existingCand) candidateId = existingCand.id;
        }
        if (!candidateId) {
          const existingByName = await query.get('SELECT id FROM candidates WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND status = ?', [name, 'Hired']);
          if (existingByName) candidateId = existingByName.id;
        }

        if (candidateId) {
          const { assignments, values } = buildUpdate(EMPLOYEE_FIELDS, rowBody);
          await query.run(
            `UPDATE candidates SET ${assignments}, status = 'Hired', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [...values, candidateId]
          );
        } else {
          let accessCode;
          let codeExists = true;
          while (codeExists) {
            accessCode = generateAccessCode('MAN-');
            const existing = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
            codeExists = !!existing;
          }
          const { columns, placeholders, values } = buildInsert(EMPLOYEE_FIELDS, rowBody);
          const candidateResult = await query.run(
            `INSERT INTO candidates (access_code, ${columns}, is_manual_entry, status, current_stage, created_at, updated_at)
             VALUES (?, ${placeholders}, 1, 'Hired', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [accessCode, ...values]
          );
          candidateId = candidateResult.id;
        }

        await query.run(
          `INSERT OR REPLACE INTO stage7_offering 
            (candidate_id, contract_type, salary_offered, allowance, start_date, offering_status, passed)
           VALUES (?, ?, ?, ?, ?, 'Accepted', 1)`,
          [candidateId, contract_type, rowBody.salary, rowBody.allowance, hire_date]
        );

        // 2. Upsert ke tabel employees (Manajemen Karyawan, Absensi, Payroll & Mobile API)
        let existingStaff = null;
        if (nik) {
          const bidx = blindIndex(nik);
          existingStaff = bidx
            ? await query.get('SELECT id FROM employees WHERE nik_bidx = ? OR nik = ?', [bidx, nik])
            : await query.get('SELECT id FROM employees WHERE nik = ?', [nik]);
        }
        if (!existingStaff && candidateId) {
          existingStaff = await query.get('SELECT id FROM employees WHERE candidate_id = ?', [candidateId]);
        }
        if (!existingStaff) {
          existingStaff = await query.get('SELECT id FROM employees WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [name]);
        }

        const staffPayload = { ...rowBody, candidate_id: candidateId };
        if (existingStaff) {
          const { assignments: staffAssign, values: staffVals } = buildStaffUpdate(STAFF_ALL_FIELDS, staffPayload);
          await query.run(
            `UPDATE employees SET ${staffAssign}, candidate_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [...staffVals, candidateId, existingStaff.id]
          );
        } else {
          const { columns: staffCols, placeholders: staffPh, values: staffVals } = buildStaffInsert(STAFF_ALL_FIELDS, staffPayload);
          await query.run(
            `INSERT INTO employees (${staffCols}, candidate_id, status, created_at, updated_at)
             VALUES (${staffPh}, ?, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [...staffVals, candidateId]
          );
        }

        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`Baris ${i + 2}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Berhasil import ${successCount} data karyawan. ${errorCount > 0 ? `Gagal ${errorCount} data.` : ''}`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('API Error (import excel):', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Server error mengimport data excel' });
  }
};

exports.downloadTemplate = (req, res) => {
  const headers = [
    'Nama Lengkap', 'NIK', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir',
    'Agama', 'Status Perkawinan', 'Jumlah Tanggungan', 'Golongan Darah',
    'No. Handphone', 'E-mail', 'Alamat KTP', 'Alamat Domisili',
    'Kontak Darurat 1 (Nama & No HP)', 'Kontak Darurat 2 (Nama & No HP)',
    'Nama Ayah', 'Nama Ibu', 'Nama Pasangan (Jika ada)',
    'Pendidikan Terakhir', 'Nama Institusi Pendidikan', 'Jurusan', 'Tahun Lulus', 'Nilai / IPK',
    'Tinggi Badan (cm)', 'Berat Badan (kg)', 'Kondisi Fisik', 'Tes Buta Warna',
    'Riwayat Penyakit', 'Alergi', 'Nomor NPWP',
    'Nama Bank & Nomor Rekening', 'Nomor BPJS Kesehatan', 'Nomor BPJS Ketenagakerjaan',
    'Ukuran Seragam', 'Cabang Penempatan', 'Jabatan', 'Tipe Karyawan', 'Tipe Kontrak', 'Tanggal Diterima'
  ];
  const example = [
    'Budi Santoso', '3174012345678901', 'Laki-laki', 'Jakarta', '1990-05-15',
    'Islam', 'Menikah', '2', 'O',
    '081234567890', 'budi@email.com', 'Jl. Merdeka No.1 Jakarta', 'Jl. Sudirman No.2 Jakarta',
    'Siti - 081111222333', 'Ahmad - 082222333444',
    'Slamet Santoso', 'Dewi Rahayu', 'Ani Santoso',
    'S1', 'Universitas Indonesia', 'Teknik Informatika', '2013', '3.50',
    '170', '65', 'Normal', 'Tidak', '', '', '12.345.678.9-012.000',
    'BCA - 1234567890', '0001234567890', '10001234567890',
    'M', 'Cabang Jakarta Pusat', 'Frontliner', 'Frontliner', 'PKWT', '2024-01-15'
  ];
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  xlsx.utils.book_append_sheet(wb, ws, 'Template Karyawan');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="template_import_karyawan.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};
