const { query } = require('../db');
const { STAFF_ALL_FIELDS, STAFF_BIODATA_FIELDS, STAFF_WORK_FIELDS, buildInsert, buildUpdate } = require('../utils/staffFields');
const { decryptRow, blindIndex } = require('../utils/fieldCrypto');

const ENCRYPTED_COLS = ['nik', 'npwp', 'bank_account', 'bpjs_health', 'bpjs_employment', 'health_history', 'allergies', 'medications'];

function sanitizeEmployee(e) {
  decryptRow(e);
  delete e.nik_bidx;
}

exports.getAll = async (req, res) => {
  try {
    const { search, branch_id, employee_type, status } = req.query;

    let sql = `
      SELECT e.*, b.name AS branch_name, b.code AS branch_code
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (e.name LIKE ? OR e.phone LIKE ? OR e.nik_bidx = ?)';
      params.push(`%${search}%`, `%${search}%`, blindIndex(search));
    }
    if (branch_id) {
      sql += ' AND e.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (employee_type) {
      sql += ' AND e.employee_type = ?';
      params.push(employee_type);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.name ASC';

    const employees = await query.all(sql, params);
    employees.forEach(sanitizeEmployee);
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('API Error (staff list):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const employee = await query.get(
      `SELECT e.*, b.name AS branch_name FROM employees e LEFT JOIN branches b ON e.branch_id = b.id WHERE e.id = ?`,
      [id]
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    sanitizeEmployee(employee);
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('API Error (staff detail):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }
    const { columns, placeholders, values } = buildInsert(STAFF_ALL_FIELDS, req.body);
    const result = await query.run(
      `INSERT INTO employees (${columns}, created_at, updated_at) VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      values
    );
    res.json({ success: true, message: `Karyawan "${req.body.name.trim()}" berhasil ditambahkan.`, employeeId: result.id });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*employees\.nik_bidx/.test(error.message)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    console.error('API Error (create staff):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }
    const existing = await query.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const { assignments, values } = buildUpdate(STAFF_ALL_FIELDS, req.body);
    await query.run(
      `UPDATE employees SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
    res.json({ success: true, message: 'Data karyawan berhasil diperbarui.' });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*employees\.nik_bidx/.test(error.message)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    console.error('API Error (update staff):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, resign_date } = req.body;
    if (!['Resign', 'Terminated'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status harus Resign atau Terminated.' });
    }
    await query.run(
      'UPDATE employees SET status = ?, resign_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, resign_date || null, id]
    );
    res.json({ success: true, message: 'Status karyawan berhasil diperbarui.' });
  } catch (error) {
    console.error('API Error (deactivate staff):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.promoteFromCandidate = async (req, res) => {
  try {
    const candidateId = parseInt(req.params.candidateId, 10);
    const candidate = await query.get(
      `SELECT c.*, s7.contract_type, s7.salary_offered, s7.allowance, s7.start_date
       FROM candidates c
       LEFT JOIN stage7_offering s7 ON c.id = s7.candidate_id
       WHERE c.id = ? AND c.status = 'Hired'`,
      [candidateId]
    );
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Kandidat Hired tidak ditemukan.' });
    }
    const alreadyPromoted = await query.get('SELECT id FROM employees WHERE candidate_id = ?', [candidateId]);
    if (alreadyPromoted) {
      return res.status(400).json({ success: false, message: 'Kandidat ini sudah dipromosikan menjadi karyawan.' });
    }

    const body = {
      ...candidate,
      candidate_id: candidateId,
      contract_type: candidate.contract_type || 'PKWT',
      salary: candidate.salary_offered || 0,
      allowance: candidate.allowance || 0,
      hire_date: candidate.start_date || candidate.hire_date || null,
      employee_type: req.body.employee_type || 'Frontliner',
      position: req.body.position || null,
    };

    const { columns, placeholders, values } = buildInsert(STAFF_ALL_FIELDS, body);
    const extraCols = 'candidate_id, created_at, updated_at';
    const extraPlaceholders = '?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP';
    const result = await query.run(
      `INSERT INTO employees (${columns}, ${extraCols}) VALUES (${placeholders}, ${extraPlaceholders})`,
      [...values, candidateId]
    );
    res.json({ success: true, message: `Karyawan "${candidate.name}" berhasil dipromosikan.`, employeeId: result.id });
  } catch (error) {
    if (error.message && /UNIQUE constraint failed.*employees\.nik_bidx/.test(error.message)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di tabel karyawan.' });
    }
    console.error('API Error (promote candidate):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getHiredCandidates = async (req, res) => {
  try {
    const rows = await query.all(`
      SELECT c.id, c.name, c.phone, c.hire_date, b.name AS branch_name,
             s7.contract_type, s7.salary_offered,
             (SELECT COUNT(*) FROM employees WHERE candidate_id = c.id) AS already_promoted
      FROM candidates c
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN stage7_offering s7 ON c.id = s7.candidate_id
      WHERE c.status = 'Hired'
      ORDER BY c.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('API Error (hired candidates):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
