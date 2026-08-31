const { query } = require('../db');
const { calcDeductionAbsent, calcDeductionLate } = require('../utils/payrollCalc');

async function getSettings() {
  const rows = await query.all('SELECT key, value FROM system_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function getPenaltyRules() {
  return query.all('SELECT * FROM late_penalty_rules ORDER BY min_count ASC');
}

/**
 * GET /api/attendance?period=YYYY-MM[&branch_id=N]
 * Returns all active employees for the period merged with their attendance record.
 */
exports.getByPeriod = async (req, res) => {
  try {
    const { period, branch_id } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Parameter period wajib format YYYY-MM.' });
    }

    let sql = `
      SELECT e.id, e.name, e.position, e.employee_type, e.salary, e.allowance,
             e.branch_id, b.name AS branch_name,
             a.id AS record_id, a.days_absent, a.late_count, a.cash_advance,
             a.fake_money, a.deduction_absent, a.deduction_late, a.asben_contribution, a.notes
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.period = ?
      WHERE e.status = 'Active'
    `;
    const params = [period];

    if (branch_id) {
      sql += ' AND e.branch_id = ?';
      params.push(branch_id);
    }
    sql += ' ORDER BY b.name ASC, e.name ASC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (attendance getByPeriod):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/attendance/:employeeId/:period
 * Upsert attendance record, recalculate deductions automatically.
 */
exports.upsert = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const { period } = req.params;
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });
    }

    const employee = await query.get('SELECT salary FROM employees WHERE id = ?', [employeeId]);
    if (!employee) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const { days_absent = 0, late_count = 0, cash_advance = 0, fake_money = 0, notes = '' } = req.body;

    const settings = await getSettings();
    const rules = await getPenaltyRules();
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
        `UPDATE attendance_records SET
          days_absent=?, late_count=?, cash_advance=?, fake_money=?,
          deduction_absent=?, deduction_late=?, asben_contribution=?,
          notes=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [days_absent, late_count, cash_advance, fake_money,
         deduction_absent, deduction_late, asben_contribution,
         notes, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO attendance_records
          (employee_id, period, days_absent, late_count, cash_advance, fake_money,
           deduction_absent, deduction_late, asben_contribution, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [employeeId, period, days_absent, late_count, cash_advance, fake_money,
         deduction_absent, deduction_late, asben_contribution, notes]
      );
    }

    const saved = await query.get(
      'SELECT * FROM attendance_records WHERE employee_id = ? AND period = ?',
      [employeeId, period]
    );
    res.json({ success: true, data: saved, message: 'Data absensi disimpan.' });
  } catch (err) {
    console.error('API Error (attendance upsert):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/attendance/summary?period=YYYY-MM[&branch_id=N]
 * Returns aggregate per branch: total_asben, total_absent_deduction, headcount.
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
