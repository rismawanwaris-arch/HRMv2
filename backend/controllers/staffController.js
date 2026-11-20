const { query } = require('../db');
const { STAFF_ALL_FIELDS, buildInsert, buildUpdate } = require('../utils/staffFields');
const { decryptRow, blindIndex, isEnabled } = require('../utils/fieldCrypto');

function sanitizeEmployee(e) {
  decryptRow(e);
  delete e.nik_bidx;
}

async function hasDuplicateNik(nik, excludeId = null) {
  const cleanNik = nik !== undefined && nik !== null ? String(nik).trim() : '';
  if (!cleanNik) return false;
  const sql = isEnabled()
    ? `SELECT id FROM employees WHERE nik_bidx = ?${excludeId ? ' AND id != ?' : ''}`
    : `SELECT id FROM employees WHERE nik = ?${excludeId ? ' AND id != ?' : ''}`;
  const param = isEnabled() ? blindIndex(cleanNik) : cleanNik;
  if (!param) return false;
  const row = await query.get(sql, excludeId ? [param, excludeId] : [param]);
  return !!row;
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
      sql += ' AND (e.name LIKE ? OR e.phone LIKE ? OR e.nik LIKE ? OR e.nik_bidx = ? OR b.name LIKE ? OR e.resign_reason LIKE ? OR e.resign_notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, blindIndex(search), `%${search}%`, `%${search}%`, `%${search}%`);
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
      if (status === 'nonactive') {
        sql += " AND e.status IN ('Resign', 'Terminated')";
      } else {
        sql += ' AND e.status = ?';
        params.push(status);
      }
    }

    sql += status === 'nonactive' ? ' ORDER BY e.resign_date DESC, e.updated_at DESC, e.name ASC' : ' ORDER BY e.name ASC';

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
    if (!req.body.name || !String(req.body.name).trim()) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }
    if (await hasDuplicateNik(req.body.nik)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }
    const { columns, placeholders, values } = buildInsert(STAFF_ALL_FIELDS, req.body);
    const result = await query.run(
      `INSERT INTO employees (${columns}, created_at, updated_at) VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      values
    );
    res.json({ success: true, message: `Karyawan "${String(req.body.name).trim()}" berhasil ditambahkan.`, employeeId: result.id });
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
    if (!req.body.name || !String(req.body.name).trim()) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }
    const existing = await query.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    if (await hasDuplicateNik(req.body.nik, id)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }

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
    const { status, resign_date, resign_reason, resign_notes } = req.body;
    if (!['Resign', 'Terminated', 'Active'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status harus Active, Resign, atau Terminated.' });
    }
    const existing = await query.get('SELECT id, candidate_id FROM employees WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    }
    if (status === 'Active') {
      await query.run(
        'UPDATE employees SET status = ?, resign_date = NULL, resign_reason = NULL, resign_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['Active', id]
      );
      if (existing.candidate_id) {
        await query.run(
          "UPDATE candidates SET status = 'Hired', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existing.candidate_id]
        );
      }
      return res.json({ success: true, message: 'Karyawan berhasil diaktifkan kembali.' });
    }
    await query.run(
      'UPDATE employees SET status = ?, resign_date = ?, resign_reason = ?, resign_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        status,
        resign_date || null,
        resign_reason ? String(resign_reason).trim() : null,
        resign_notes ? String(resign_notes).trim() : null,
        id,
      ]
    );
    if (existing.candidate_id) {
      await query.run(
        "UPDATE candidates SET status = 'Resigned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Hired'",
        [existing.candidate_id]
      );
    }
    res.json({ success: true, message: 'Status dan alasan keluar karyawan berhasil disimpan.' });
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
    decryptRow(candidate);
    const alreadyPromoted = await query.get('SELECT id FROM employees WHERE candidate_id = ?', [candidateId]);
    if (alreadyPromoted) {
      return res.status(400).json({ success: false, message: 'Kandidat ini sudah dipromosikan menjadi karyawan.' });
    }
    if (await hasDuplicateNik(candidate.nik)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di tabel karyawan.' });
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
