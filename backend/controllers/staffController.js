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

function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDaysUtc(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDaysUtc(targetDateStr, baseDateStr) {
  const t = new Date(`${String(targetDateStr).slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${String(baseDateStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((t.getTime() - b.getTime()) / 86400000);
}

exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.body.name || !String(req.body.name).trim()) {
      return res.status(400).json({ success: false, message: 'Nama karyawan wajib diisi.' });
    }
    const existing = await query.get(
      `SELECT e.id, e.position, e.branch_id, b.name AS branch_name, e.salary, e.allowance, e.contract_type, e.contract_end
       FROM employees e LEFT JOIN branches b ON e.branch_id = b.id WHERE e.id = ?`,
      [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    if (await hasDuplicateNik(req.body.nik, id)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar di sistem.' });
    }

    const { assignments, values } = buildUpdate(STAFF_ALL_FIELDS, req.body);
    await query.run(
      `UPDATE employees SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );

    const updated = await query.get(
      `SELECT e.position, e.branch_id, b.name AS branch_name, e.salary, e.allowance, e.contract_type, e.contract_end
       FROM employees e LEFT JOIN branches b ON e.branch_id = b.id WHERE e.id = ?`,
      [id]
    );
    const actor = req.user?.username || 'system';
    const effDate = todayLocalStr();
    const historyEvents = [];

    if ((existing.position || '') !== (updated.position || '')) {
      historyEvents.push(['Perubahan Jabatan', existing.position || '-', updated.position || '-', 'Perubahan jabatan melalui edit karyawan']);
    }
    if ((existing.branch_id || null) !== (updated.branch_id || null)) {
      historyEvents.push([
        'Mutasi Cabang',
        existing.branch_name || (existing.branch_id ? `#${existing.branch_id}` : '-'),
        updated.branch_name || (updated.branch_id ? `#${updated.branch_id}` : '-'),
        'Mutasi penempatan cabang',
      ]);
    }
    if (Number(existing.salary || 0) !== Number(updated.salary || 0)) {
      historyEvents.push(['Penyesuaian Gaji', String(existing.salary || 0), String(updated.salary || 0), 'Perubahan gaji pokok']);
    }
    if ((existing.contract_type || '') !== (updated.contract_type || '')) {
      historyEvents.push(['Perubahan Tipe Kontrak', existing.contract_type || '-', updated.contract_type || '-', 'Perubahan tipe kontrak kerja']);
    }
    if ((existing.contract_end || '') !== (updated.contract_end || '')) {
      historyEvents.push(['Perubahan Tanggal Kontrak', existing.contract_end || '-', updated.contract_end || '-', 'Perubahan tanggal berakhir kontrak']);
    }

    for (const [evType, oldVal, newVal, note] of historyEvents) {
      await query.run(
        'INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, evType, effDate, oldVal, newVal, note, actor]
      );
    }

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
    const existing = await query.get('SELECT id, status, candidate_id FROM employees WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    }
    const actor = req.user?.username || 'system';
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
      await query.run(
        'INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'Aktifkan Kembali', todayLocalStr(), existing.status, 'Active', 'Karyawan diaktifkan kembali', actor]
      );
      return res.json({ success: true, message: 'Karyawan berhasil diaktifkan kembali.' });
    }
    const effDate = resign_date || todayLocalStr();
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
    await query.run(
      'INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, 'Status Keluar', effDate, existing.status, status, resign_reason ? String(resign_reason).trim() : (resign_notes || null), actor]
    );
    res.json({ success: true, message: 'Status dan alasan keluar karyawan berhasil disimpan.' });
  } catch (error) {
    console.error('API Error (deactivate staff):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getContractAlerts = async (req, res) => {
  try {
    const settingRow = await query.get("SELECT value FROM system_settings WHERE key = 'contract_reminder_days'");
    const defaultDays = Math.max(1, parseInt(settingRow?.value, 10) || 30);
    const daysParam = req.query.days !== undefined ? parseInt(req.query.days, 10) : defaultDays;
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : defaultDays;

    const todayStr = todayLocalStr();
    const cutoffStr = addDaysUtc(todayStr, days);

    const rows = await query.all(
      `SELECT e.id, e.name, e.position, e.employee_type, e.contract_type, e.contract_start, e.contract_end, e.probation_end,
              e.salary, e.allowance, e.branch_id, b.name AS branch_name
       FROM employees e
       LEFT JOIN branches b ON e.branch_id = b.id
       WHERE e.status = 'Active'
         AND ((e.contract_end IS NOT NULL AND e.contract_end != '' AND e.contract_end <= ?)
           OR (e.probation_end IS NOT NULL AND e.probation_end != '' AND e.probation_end <= ?))`,
      [cutoffStr, cutoffStr]
    );

    const alerts = [];
    for (const emp of rows) {
      if (emp.contract_end && emp.contract_end <= cutoffStr) {
        const diff = diffDaysUtc(emp.contract_end, todayStr);
        if (diff !== null) {
          alerts.push({ ...emp, alert_type: 'contract', target_date: emp.contract_end, days_remaining: diff });
        }
      }
      if (emp.probation_end && emp.probation_end <= cutoffStr) {
        const diff = diffDaysUtc(emp.probation_end, todayStr);
        if (diff !== null) {
          alerts.push({ ...emp, alert_type: 'probation', target_date: emp.probation_end, days_remaining: diff });
        }
      }
    }
    alerts.sort((a, b) => a.days_remaining - b.days_remaining);
    res.json({ success: true, data: alerts, reminder_days: days });
  } catch (error) {
    console.error('API Error (getContractAlerts):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    const rows = await query.all(
      'SELECT * FROM employee_history WHERE employee_id = ? ORDER BY effective_date DESC, id DESC',
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('API Error (getHistory):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.addHistory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const { event_type, effective_date, old_value = '', new_value = '', notes = '' } = req.body;
    if (!event_type || !String(event_type).trim()) {
      return res.status(400).json({ success: false, message: 'Jenis riwayat (event_type) wajib diisi.' });
    }
    if (!effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(effective_date))) {
      return res.status(400).json({ success: false, message: 'Tanggal efektif wajib format YYYY-MM-DD.' });
    }

    const actor = req.user?.username || 'system';
    const result = await query.run(
      'INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, String(event_type).trim(), effective_date, old_value || null, new_value || null, notes || null, actor]
    );
    const created = await query.get('SELECT * FROM employee_history WHERE id = ?', [result.id]);
    res.json({ success: true, data: created, message: 'Riwayat karir berhasil dicatat.' });
  } catch (error) {
    console.error('API Error (addHistory):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.renewContract = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const emp = await query.get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    if (emp.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Hanya karyawan aktif yang dapat diperpanjang/diangkat.' });
    }

    const {
      action = 'renew',
      contract_type,
      contract_start,
      contract_end,
      clear_probation = false,
      salary,
      allowance,
      notes = '',
    } = req.body;

    if (!['renew', 'permanent'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action harus renew atau permanent.' });
    }

    const nextType = action === 'permanent' ? 'PKWTT' : (contract_type || emp.contract_type || 'PKWT');
    const nextStart = contract_start !== undefined ? (contract_start || null) : emp.contract_start;
    const nextEnd = action === 'permanent' ? null : (contract_end !== undefined ? (contract_end || null) : emp.contract_end);
    const nextProbation = (action === 'permanent' || clear_probation) ? null : emp.probation_end;
    const nextSalary = salary !== undefined && salary !== '' ? (parseFloat(salary) || 0) : emp.salary;
    const nextAllowance = allowance !== undefined && allowance !== '' ? (parseFloat(allowance) || 0) : emp.allowance;

    if (action === 'renew' && !nextEnd) {
      return res.status(400).json({ success: false, message: 'Tanggal berakhir kontrak baru (contract_end) wajib diisi.' });
    }

    const actor = req.user?.username || 'system';
    const effDate = nextStart || todayLocalStr();
    const evType = action === 'permanent' ? 'Pengangkatan Tetap' : 'Perpanjangan Kontrak';
    const oldVal = `${emp.contract_type || '-'}${emp.contract_end ? ` (s.d. ${emp.contract_end})` : ''}`;
    const newVal = `${nextType}${nextEnd ? ` (s.d. ${nextEnd})` : ''}`;

    await query.run('BEGIN TRANSACTION');
    try {
      await query.run(
        `UPDATE employees
         SET contract_type = ?, contract_start = ?, contract_end = ?, probation_end = ?,
             salary = ?, allowance = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextType, nextStart, nextEnd, nextProbation, nextSalary, nextAllowance, id]
      );
      await query.run(
        'INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, evType, effDate, oldVal, newVal, notes || null, actor]
      );
      if (Number(emp.salary || 0) !== Number(nextSalary || 0)) {
        await query.run(
          'INSERT INTO employee_history (employee_id, event_type, effective_date, old_value, new_value, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, 'Penyesuaian Gaji', effDate, String(emp.salary || 0), String(nextSalary || 0), `${evType}${notes ? `: ${notes}` : ''}`, actor]
        );
      }
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    const updated = await query.get(
      'SELECT e.*, b.name AS branch_name FROM employees e LEFT JOIN branches b ON e.branch_id = b.id WHERE e.id = ?',
      [id]
    );
    sanitizeEmployee(updated);
    res.json({ success: true, data: updated, message: `${evType} berhasil disimpan.` });
  } catch (error) {
    console.error('API Error (renewContract):', error);
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
