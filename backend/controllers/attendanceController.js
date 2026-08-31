const { query } = require('../db');
const { calcDeductionAbsent, calcDeductionLate } = require('../utils/payrollCalc');

async function getSettings() {
  const rows = await query.all('SELECT key, value FROM system_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function getPenaltyRules() {
  return query.all('SELECT * FROM late_penalty_rules ORDER BY min_count ASC');
}

// Compute attendance status from shift and check_in_time.
// Returns { status, is_late }
function computeStatus(shift, checkInTime, settings) {
  if (!checkInTime) return { status: 'Tidak Hadir', is_late: 0 };
  const cutoff = shift === 'Siang'
    ? (settings.shift_siang_cutoff || '14:30')
    : (settings.shift_pagi_cutoff || '06:30');
  const late = checkInTime > cutoff; // lexicographic compare works for HH:MM
  return { status: late ? 'Telat' : 'Hadir', is_late: late ? 1 : 0 };
}

// Sync daily records for one employee+period → update attendance_records aggregate
async function syncEmployeePeriod(employeeId, period, settings, rules) {
  const monthPattern = `${period}-%`;
  const agg = await query.get(
    `SELECT
       COUNT(CASE WHEN status = 'Tidak Hadir' THEN 1 END) AS days_absent,
       COUNT(CASE WHEN is_late = 1 THEN 1 END) AS late_count
     FROM daily_attendance
     WHERE employee_id = ? AND date LIKE ?`,
    [employeeId, monthPattern]
  );

  const days_absent = agg ? agg.days_absent : 0;
  const late_count = agg ? agg.late_count : 0;

  const employee = await query.get('SELECT salary FROM employees WHERE id = ?', [employeeId]);
  if (!employee) return;

  const workingDays = parseInt(settings.working_days_per_month) || 25;
  const deduction_absent = calcDeductionAbsent(days_absent, employee.salary, workingDays);
  const deduction_late = calcDeductionLate(late_count, rules);
  const asben_contribution = deduction_late;

  const existing = await query.get(
    'SELECT id FROM attendance_records WHERE employee_id = ? AND period = ?',
    [employeeId, period]
  );

  if (existing) {
    await query.run(
      `UPDATE attendance_records
         SET days_absent=?, late_count=?, deduction_absent=?, deduction_late=?,
             asben_contribution=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [days_absent, late_count, deduction_absent, deduction_late, asben_contribution, existing.id]
    );
  } else {
    await query.run(
      `INSERT INTO attendance_records
         (employee_id, period, days_absent, late_count, deduction_absent, deduction_late, asben_contribution)
       VALUES (?,?,?,?,?,?,?)`,
      [employeeId, period, days_absent, late_count, deduction_absent, deduction_late, asben_contribution]
    );
  }
}

/**
 * GET /api/attendance/daily?date=YYYY-MM-DD[&branch_id=N]
 * Returns all active employees with their daily attendance record for the given date.
 */
exports.getByDate = async (req, res) => {
  try {
    const { date, branch_id } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Parameter date wajib format YYYY-MM-DD.' });
    }

    let sql = `
      SELECT e.id, e.name, e.position, e.employee_type,
             e.branch_id, b.name AS branch_name,
             d.id AS record_id, d.shift, d.check_in_time, d.status, d.is_late, d.notes
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN daily_attendance d ON d.employee_id = e.id AND d.date = ?
      WHERE e.status = 'Active'
    `;
    const params = [date];
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(branch_id); }
    sql += ' ORDER BY b.name ASC, e.name ASC';

    const rows = await query.all(sql, params);
    // Employees without a record get default Belum Absen status
    const result = rows.map(r => ({
      ...r,
      status: r.status || 'Belum Absen',
      shift: r.shift || '',
      check_in_time: r.check_in_time || '',
      notes: r.notes || '',
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('API Error (attendance getByDate):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/attendance/daily/:employeeId/:date
 * Upsert daily attendance for one employee.
 * Body: { shift, check_in_time?, status?, notes? }
 * - If check_in_time provided: auto-compute status (Hadir/Telat) from shift cutoff.
 * - If no check_in_time: use explicit status (Tidak Hadir / Izin / Sakit).
 * Auto-syncs to attendance_records after saving.
 */
exports.upsertDaily = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Format date harus YYYY-MM-DD.' });
    }

    const emp = await query.get('SELECT id FROM employees WHERE id = ? AND status = ?', [employeeId, 'Active']);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan atau tidak aktif.' });

    const { shift = '', check_in_time = '', status: bodyStatus = 'Tidak Hadir', notes = '' } = req.body;
    const settings = await getSettings();

    let status, is_late;
    if (check_in_time) {
      const computed = computeStatus(shift, check_in_time, settings);
      status = computed.status;
      is_late = computed.is_late;
    } else {
      // Manual status: Tidak Hadir, Izin, Sakit
      const allowed = ['Tidak Hadir', 'Izin', 'Sakit'];
      status = allowed.includes(bodyStatus) ? bodyStatus : 'Tidak Hadir';
      is_late = 0;
    }

    const existing = await query.get(
      'SELECT id FROM daily_attendance WHERE employee_id = ? AND date = ?',
      [employeeId, date]
    );

    if (existing) {
      await query.run(
        `UPDATE daily_attendance SET shift=?, check_in_time=?, status=?, is_late=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [shift, check_in_time || null, status, is_late, notes || null, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO daily_attendance (employee_id, date, shift, check_in_time, status, is_late, notes) VALUES (?,?,?,?,?,?,?)`,
        [employeeId, date, shift, check_in_time || null, status, is_late, notes || null]
      );
    }

    // Auto-sync to attendance_records for payroll
    const period = date.substring(0, 7);
    const rules = await getPenaltyRules();
    await syncEmployeePeriod(employeeId, period, settings, rules);

    const saved = await query.get(
      'SELECT * FROM daily_attendance WHERE employee_id = ? AND date = ?',
      [employeeId, date]
    );
    res.json({ success: true, data: saved, message: 'Absensi disimpan.' });
  } catch (err) {
    console.error('API Error (attendance upsertDaily):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/attendance/monthly?period=YYYY-MM[&branch_id=N]
 * Monthly summary per employee aggregated from daily_attendance.
 * Also includes cash_advance/fake_money from attendance_records (manual inputs).
 */
exports.getMonthlySummary = async (req, res) => {
  try {
    const { period, branch_id } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Parameter period wajib format YYYY-MM.' });
    }
    const monthPattern = `${period}-%`;

    let sql = `
      SELECT e.id, e.name, e.position, e.employee_type, e.branch_id, b.name AS branch_name,
             COUNT(d.id) AS total_recorded,
             COUNT(CASE WHEN d.status = 'Hadir' THEN 1 END) AS days_hadir,
             COUNT(CASE WHEN d.status = 'Telat' THEN 1 END) AS days_telat,
             COUNT(CASE WHEN d.status = 'Tidak Hadir' THEN 1 END) AS days_tidak_hadir,
             COUNT(CASE WHEN d.status = 'Izin' THEN 1 END) AS days_izin,
             COUNT(CASE WHEN d.status = 'Sakit' THEN 1 END) AS days_sakit,
             COUNT(CASE WHEN d.is_late = 1 THEN 1 END) AS late_count,
             a.id AS record_id, a.days_absent, a.late_count AS rec_late_count,
             a.cash_advance, a.fake_money,
             a.deduction_absent, a.deduction_late, a.asben_contribution, a.notes AS rec_notes
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN daily_attendance d ON d.employee_id = e.id AND d.date LIKE ?
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.period = ?
      WHERE e.status = 'Active'
    `;
    const params = [monthPattern, period];
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(branch_id); }
    sql += ' GROUP BY e.id ORDER BY b.name ASC, e.name ASC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (attendance getMonthlySummary):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/attendance/daily-detail/:employeeId?period=YYYY-MM
 * Day-by-day records for one employee in a given month.
 */
exports.getEmployeeDailyDetail = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const { period } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'period wajib format YYYY-MM.' });
    }
    const monthPattern = `${period}-%`;
    const rows = await query.all(
      'SELECT * FROM daily_attendance WHERE employee_id = ? AND date LIKE ? ORDER BY date ASC',
      [employeeId, monthPattern]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (attendance getEmployeeDailyDetail):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/attendance/record/:employeeId/:period
 * Update cash_advance/fake_money/notes on the monthly attendance_record.
 */
exports.upsertRecord = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const { period } = req.params;
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });
    }
    const emp = await query.get('SELECT id FROM employees WHERE id = ?', [employeeId]);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const { cash_advance = 0, fake_money = 0, notes = '' } = req.body;

    const existing = await query.get(
      'SELECT id FROM attendance_records WHERE employee_id = ? AND period = ?',
      [employeeId, period]
    );
    if (existing) {
      await query.run(
        `UPDATE attendance_records SET cash_advance=?, fake_money=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [cash_advance, fake_money, notes, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO attendance_records (employee_id, period, cash_advance, fake_money, notes) VALUES (?,?,?,?,?)`,
        [employeeId, period, cash_advance, fake_money, notes]
      );
    }
    const saved = await query.get(
      'SELECT * FROM attendance_records WHERE employee_id = ? AND period = ?',
      [employeeId, period]
    );
    res.json({ success: true, data: saved, message: 'Kasbon/uang palsu disimpan.' });
  } catch (err) {
    console.error('API Error (attendance upsertRecord):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/attendance/sync/:period
 * Sync all employees' daily_attendance → attendance_records for the period.
 */
exports.syncPeriod = async (req, res) => {
  try {
    const { period } = req.params;
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });
    }
    const settings = await getSettings();
    const rules = await getPenaltyRules();

    // Get all employees with any daily record in this period
    const monthPattern = `${period}-%`;
    const employees = await query.all(
      `SELECT DISTINCT employee_id FROM daily_attendance WHERE date LIKE ?`,
      [monthPattern]
    );

    for (const { employee_id } of employees) {
      await syncEmployeePeriod(employee_id, period, settings, rules);
    }

    res.json({ success: true, message: `Sinkronisasi selesai untuk ${employees.length} karyawan.` });
  } catch (err) {
    console.error('API Error (attendance syncPeriod):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/attendance/summary?period=YYYY-MM[&branch_id=N]
 * Branch-level ASBEN aggregate (used by payroll/financial reports).
 */
exports.summary = async (req, res) => {
  try {
    const { period, branch_id } = req.query;
    if (!period) return res.status(400).json({ success: false, message: 'period wajib.' });

    let sql = `
      SELECT b.id AS branch_id, b.name AS branch_name,
             COUNT(a.id) AS recorded,
             COALESCE(SUM(a.days_absent),0) AS total_absent_days,
             COALESCE(SUM(a.deduction_absent),0) AS total_absent_deduction,
             COALESCE(SUM(a.deduction_late),0) AS total_late_deduction,
             COALESCE(SUM(a.asben_contribution),0) AS total_asben,
             COALESCE(SUM(a.cash_advance),0) AS total_kasbon,
             COALESCE(SUM(a.fake_money),0) AS total_fake_money
      FROM branches b
      LEFT JOIN employees e ON e.branch_id = b.id AND e.status = 'Active'
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.period = ?
      WHERE b.status = 'Active'
    `;
    const params = [period];
    if (branch_id) { sql += ' AND b.id = ?'; params.push(branch_id); }
    sql += ' GROUP BY b.id ORDER BY b.name ASC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (attendance summary):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
