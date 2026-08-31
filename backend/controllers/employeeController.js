const xlsx = require('xlsx');
const fs = require('fs');
const { query } = require('../db');
const { generateAccessCode } = require('../utils/helpers');

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
      sql += ' AND (c.name LIKE ? OR c.nik LIKE ? OR c.phone LIKE ? OR b.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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
    const {
      name, nik, gender, birth_place, birth_date, religion,
      marital_status, dependents, blood_type,
      phone, email, address_ktp, address_domicile,
      emergency_contact_1, emergency_contact_2,
      father_name, mother_name, spouse_name,
      education_level, education_institution, education_major, education_years, education_grade,
      height, weight, physical_condition, color_blind_test, health_history, allergies,
      npwp, bank_name, bank_account, bpjs_health, bpjs_employment, uniform_size,
      branch_id, hire_date, contract_type, salary_offered, allowance
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }

    let accessCode;
    let codeExists = true;
    while (codeExists) {
      accessCode = generateAccessCode('MAN-');
      const existing = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
      codeExists = !!existing;
    }

    const candidateResult = await query.run(
      `INSERT INTO candidates (
        access_code, name, nik, gender, birth_place, birth_date, religion,
        marital_status, dependents, blood_type,
        phone, email, address_ktp, address_domicile,
        emergency_contact_1, emergency_contact_2,
        father_name, mother_name, spouse_name,
        education_level, education_institution, education_major, education_years, education_grade,
        height, weight, physical_condition, color_blind_test, health_history, allergies,
        npwp, bank_name, bank_account, bpjs_health, bpjs_employment, uniform_size,
        branch_id, hire_date, is_manual_entry,
        status, current_stage, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, 1,
        'Hired', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        accessCode, name.trim(), nik || null, gender || null, birth_place || null, birth_date || null, religion || null,
        marital_status || null, dependents || 0, blood_type || null,
        phone || null, email || null, address_ktp || null, address_domicile || null,
        emergency_contact_1 || null, emergency_contact_2 || null,
        father_name || null, mother_name || null, spouse_name || null,
        education_level || null, education_institution || null, education_major || null, education_years || null, education_grade || null,
        height || null, weight || null, physical_condition || null, color_blind_test || null, health_history || null, allergies || null,
        npwp || null, bank_name || null, bank_account || null, bpjs_health || null, bpjs_employment || null, uniform_size || null,
        branch_id || null, hire_date || null
      ]
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
      message: `Karyawan "${name}" berhasil ditambahkan ke Data Karyawan.`,
      candidateId
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed: candidates.nik')) {
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
    const {
      name, nik, gender, birth_place, birth_date, religion,
      marital_status, dependents, blood_type,
      phone, email, address_ktp, address_domicile,
      emergency_contact_1, emergency_contact_2,
      father_name, mother_name, spouse_name,
      education_level, education_institution, education_major, education_years, education_grade,
      height, weight, physical_condition, color_blind_test, health_history, allergies,
      npwp, bank_name, bank_account, bpjs_health, bpjs_employment, uniform_size,
      branch_id, hire_date, contract_type, salary_offered, allowance
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }

    const existing = await query.get('SELECT id FROM candidates WHERE id = ?', [employeeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan' });
    }

    await query.run(
      `UPDATE candidates SET 
        name = ?, nik = ?, gender = ?, birth_place = ?, birth_date = ?, religion = ?,
        marital_status = ?, dependents = ?, blood_type = ?,
        phone = ?, email = ?, address_ktp = ?, address_domicile = ?,
        emergency_contact_1 = ?, emergency_contact_2 = ?,
        father_name = ?, mother_name = ?, spouse_name = ?,
        education_level = ?, education_institution = ?, education_major = ?, education_years = ?, education_grade = ?,
        height = ?, weight = ?, physical_condition = ?, color_blind_test = ?, health_history = ?, allergies = ?,
        npwp = ?, bank_name = ?, bank_account = ?, bpjs_health = ?, bpjs_employment = ?, uniform_size = ?,
        branch_id = ?, hire_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        name.trim(), nik || null, gender || null, birth_place || null, birth_date || null, religion || null,
        marital_status || null, dependents || 0, blood_type || null,
        phone || null, email || null, address_ktp || null, address_domicile || null,
        emergency_contact_1 || null, emergency_contact_2 || null,
        father_name || null, mother_name || null, spouse_name || null,
        education_level || null, education_institution || null, education_major || null, education_years || null, education_grade || null,
        height || null, weight || null, physical_condition || null, color_blind_test || null, health_history || null, allergies || null,
        npwp || null, bank_name || null, bank_account || null, bpjs_health || null, bpjs_employment || null, uniform_size || null,
        branch_id || null, hire_date || null, employeeId
      ]
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
    if (error.message && error.message.includes('UNIQUE constraint failed: candidates.nik')) {
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
    const branches = await query.all('SELECT id, name FROM branches');
    const branchMap = {};
    branches.forEach(b => {
      branchMap[b.name.toLowerCase()] = b.id;
    });

    let successCount = 0;
    let errorCount = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const name = (row['Nama Lengkap'] || row['Nama'] || '').toString().trim();
        if (!name) continue; // Skip baris kosong

        // Parsing Tempat & Tanggal Lahir
        let birth_place = '';
        let birth_date = '';
        const ttl = (row['Tempat & Tanggal Lahir'] || '').toString();
        if (ttl) {
          const parts = ttl.split(',');
          if (parts.length > 1) {
            birth_place = parts[0].trim();
            // Parsing tanggal dari format (bisa bervariasi, kita simpan stringnya atau ubah ke format YYYY-MM-DD jika memungkinkan)
            // Untuk amannya, kita simpan string asli jika tidak valid date, tapi untuk input date type html idealnya YYYY-MM-DD
            // Disini kita akan simpan apa adanya, tapi user idealnya format YYYY-MM-DD
            birth_date = parts.slice(1).join(',').trim();
          } else {
            birth_place = ttl.trim();
          }
        }

        // Parsing Bank & Rekening
        let bank_name = '';
        let bank_account = '';
        const bankInfo = (row['Nama Bank & Nomor Rekening'] || '').toString();
        if (bankInfo) {
          const parts = bankInfo.split(/[ -]+/);
          if (parts.length > 1) {
            bank_name = parts[0];
            bank_account = parts.slice(1).join(' ');
          } else {
            bank_name = bankInfo;
          }
        }

        // Parsing Cabang
        const branchStr = (row['Cabang Penempatan'] || '').toString().trim().toLowerCase();
        let branch_id = null;
        if (branchStr && branchMap[branchStr]) {
          branch_id = branchMap[branchStr];
        } else {
          // Cari pendekatan terdekat jika perlu, atau null
        }

        const phone = (row['No. Handphone'] || row['No. Telephone'] || '').toString().trim();
        let nik = (row['NIK'] || row['Nomor KTP'] || '').toString().trim();
        if (!nik) nik = null; // Biar bisa unik atau null

        // Generate access code
        let accessCode;
        let codeExists = true;
        while (codeExists) {
          accessCode = generateAccessCode('MAN-');
          const existing = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
          codeExists = !!existing;
        }

        const candidateResult = await query.run(
          `INSERT INTO candidates (
            access_code, name, nik, gender, birth_place, birth_date, religion,
            marital_status, dependents, blood_type,
            phone, email, address_ktp, address_domicile,
            emergency_contact_1, emergency_contact_2,
            father_name, mother_name, spouse_name,
            education_level, education_institution, education_major, education_years, education_grade,
            height, weight, physical_condition, color_blind_test, health_history, allergies,
            npwp, bank_name, bank_account, bpjs_health, bpjs_employment, uniform_size,
            branch_id, hire_date, is_manual_entry,
            status, current_stage, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, 1,
            'Hired', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            accessCode, 
            name, 
            nik, 
            (row['Jenis Kelamin'] || '').toString().trim(), 
            birth_place, 
            birth_date, 
            (row['Agama'] || '').toString().trim(),
            (row['Status Perkawinan'] || '').toString().trim(), 
            parseInt(row['Jumlah Tanggungan']) || 0, 
            (row['Golongan Darah'] || '').toString().trim(),
            phone, 
            (row['E-mail'] || '').toString().trim(), 
            (row['Alamat KTP'] || '').toString().trim(), 
            (row['Alamat Domisili'] || '').toString().trim(),
            (row['Kontak Darurat 1 (Nama & No HP)'] || '').toString().trim(), 
            (row['Kontak Darurat 2 (Nama & No HP)'] || '').toString().trim(),
            (row['Nama Ayah'] || '').toString().trim(), 
            (row['Nama Ibu'] || '').toString().trim(), 
            (row['Nama Pasangan (Jika ada)'] || '').toString().trim(),
            (row['Pendidikan Terakhir'] || '').toString().trim(), 
            (row['Nama Institusi Pendidikan'] || '').toString().trim(), 
            (row['Jurusan'] || '').toString().trim(), 
            (row['Tahun Lulus'] || '').toString().trim(), 
            (row['Nilai / IPK'] || '').toString().trim(),
            parseInt(row['Tinggi Badan (cm)']) || null, 
            parseInt(row['Berat Badan (kg)']) || null, 
            (row['Kondisi Fisik'] || '').toString().trim(), 
            (row['Tes Buta Warna'] || '').toString().trim(), 
            (row['Riwayat Penyakit'] || '').toString().trim(), 
            (row['Alergi'] || '').toString().trim(),
            (row['Nomor NPWP'] || '').toString().trim(), 
            bank_name, 
            bank_account, 
            (row['Nomor BPJS Kesehatan'] || '').toString().trim(), 
            (row['Nomor BPJS Ketenagakerjaan'] || '').toString().trim(), 
            (row['Ukuran Seragam'] || '').toString().trim(),
            branch_id, 
            (row['Tanggal Diterima'] || '').toString().trim()
          ]
        );

        const candidateId = candidateResult.id;

        await query.run(
          `INSERT OR REPLACE INTO stage7_offering 
            (candidate_id, contract_type, salary_offered, allowance, start_date, offering_status, passed)
           VALUES (?, ?, ?, ?, ?, 'Accepted', 1)`,
          [
            candidateId,
            (row['Tipe Kontrak'] || 'PKWT').toString().trim(),
            0,
            0,
            (row['Tanggal Diterima'] || '').toString().trim()
          ]
        );

        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`Baris ${i + 2}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Berhasil import ${successCount} data. ${errorCount > 0 ? `Gagal ${errorCount} data.` : ''}`,
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
