const { query } = require('../db');
const {
  calcDeductionAbsent,
  calcDeductionLate,
  getPeriodDateRange,
} = require('./payrollCalc');

async function getSettings() {
  const rows = await query.all('SELECT key, value FROM system_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function getPenaltyRules() {
  return query.all('SELECT * FROM late_penalty_rules ORDER BY min_count ASC');
}

function normalizeTimeHHMM(raw) {
  if (!raw) return '';
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Compute attendance status from shift and check_in_time.
 * @returns {{ status: string, is_late: number }}
 */
function computeStatus(shift, checkInTime, settings) {
  if (!checkInTime) return { status: 'Tidak Hadir', is_late: 0 };
  const normalized = normalizeTimeHHMM(checkInTime) || String(checkInTime).trim();
  const cutoff = shift === 'Siang'
    ? (normalizeTimeHHMM(settings.shift_siang_cutoff) || '14:30')
    : (normalizeTimeHHMM(settings.shift_pagi_cutoff) || '06:30');
  const late = normalized > cutoff;
  return { status: late ? 'Telat' : 'Hadir', is_late: late ? 1 : 0 };
}

/**
 * Sync daily records for one employee+period -> update attendance_records aggregate.
 */
async function syncEmployeePeriod(employeeId, period, settings, rules) {
  const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
  const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
  const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);
  const agg = await query.get(
    `SELECT
       COUNT(CASE WHEN status = 'Tidak Hadir' THEN 1 END) AS days_absent,
       COUNT(CASE WHEN is_late = 1 THEN 1 END) AS late_count
     FROM daily_attendance
     WHERE employee_id = ? AND date BETWEEN ? AND ?`,
    [employeeId, startDate, endDate]
  );

  const days_absent = agg ? agg.days_absent : 0;
  const late_count = agg ? agg.late_count : 0;

  const employee = await query.get('SELECT salary FROM employees WHERE id = ?', [employeeId]);
  if (!employee) return;

  const workingDays = parseInt(settings.working_days_per_month, 10) || 25;
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

module.exports = {
  getSettings,
  getPenaltyRules,
  normalizeTimeHHMM,
  computeStatus,
  syncEmployeePeriod,
};
