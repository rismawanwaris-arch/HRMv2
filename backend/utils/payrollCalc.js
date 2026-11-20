/**
 * Shared payroll calculation helpers.
 * All monetary values are in IDR (integer rupiah).
 */

/**
 * Calculate absence deduction.
 * @param {number} daysAbsent
 * @param {number} salary - Monthly base salary
 * @param {number} workingDays - Standard working days per month
 */
function calcDeductionAbsent(daysAbsent, salary, workingDays) {
  if (!daysAbsent || !salary || !workingDays) return 0;
  return Math.round((salary / workingDays) * daysAbsent);
}

/**
 * Calculate lateness deduction based on total late count and penalty rules.
 * Finds the bracket that covers the total count, applies that rate to ALL occurrences.
 * @param {number} lateCount
 * @param {Array<{min_count, max_count, penalty_per_occurrence}>} rules - sorted ascending by min_count
 * @returns {number} total deduction (IDR)
 */
function calcDeductionLate(lateCount, rules) {
  if (!lateCount || !rules || !rules.length) return 0;
  const rule = rules.find(
    (r) => r.min_count <= lateCount && (r.max_count === null || r.max_count >= lateCount)
  );
  if (!rule) return 0;
  return lateCount * rule.penalty_per_occurrence;
}

/**
 * Calculate Take Home Pay.
 * bonus_ditahan is intentionally excluded (it's a branch ledger item, not paid out).
 * @param {object} entry - payroll entry fields
 */
function calcTHP(entry) {
  const gross = (entry.salary || 0) + (entry.allowance || 0);
  const totalBonus =
    (entry.bonus_penjualan || 0) +
    (entry.bonus_tartun || 0) +
    (entry.bonus_lain || 0);
  const totalDeductions =
    (entry.deduction_kasbon || 0) +
    (entry.deduction_absent || 0) +
    (entry.deduction_late || 0) +
    (entry.deduction_fake_money || 0);
  return Math.round(gross + totalBonus - totalDeductions);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Compute startDate/endDate (YYYY-MM-DD) for a payroll period YYYY-MM given cutoff startDay/endDay.
 * When startDay > endDay (e.g. 29..28), spans previous month's startDay to current month's endDay.
 * When startDay <= endDay (e.g. 1..31), stays within the same calendar month.
 */
function getPeriodDateRange(period, startDay = 29, endDay = 28) {
  const [year, month] = String(period).split('-').map(Number);
  const sDayReq = Math.max(1, parseInt(startDay, 10) || 29);
  const eDayReq = Math.max(1, parseInt(endDay, 10) || 28);

  let startYear = year;
  let startMonth = month;
  if (sDayReq > eDayReq) {
    startMonth = month === 1 ? 12 : month - 1;
    startYear = month === 1 ? year - 1 : year;
  }

  const clampedStartDay = Math.min(sDayReq, daysInMonth(startYear, startMonth));
  const clampedEndDay = Math.min(eDayReq, daysInMonth(year, month));

  const pad = (n) => String(n).padStart(2, '0');
  return {
    startDate: `${startYear}-${pad(startMonth)}-${pad(clampedStartDay)}`,
    endDate: `${year}-${pad(month)}-${pad(clampedEndDay)}`,
    startYear,
    startMonth,
    clampedStartDay,
    endYear: year,
    endMonth: month,
    clampedEndDay,
  };
}

/**
 * Map a concrete attendance date (YYYY-MM-DD) to its payroll period (YYYY-MM).
 */
function getPeriodForDate(dateStr, startDay = 29, endDay = 28) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const sDayReq = Math.max(1, parseInt(startDay, 10) || 29);
  const eDayReq = Math.max(1, parseInt(endDay, 10) || 28);
  let targetYear = year;
  let targetMonth = month;
  if (sDayReq > eDayReq && day >= sDayReq) {
    targetMonth = month === 12 ? 1 : month + 1;
    targetYear = month === 12 ? year + 1 : year;
  }
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
}

/**
 * Format period YYYY-MM into a human-readable range label.
 * Clamps invalid dates (e.g. Feb 29 in non-leap year -> Feb 28).
 */
function getPeriodLabel(period, startDay = 29, endDay = 28) {
  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const r = getPeriodDateRange(period, startDay, endDay);
  return `${r.clampedStartDay} ${MONTHS[r.startMonth - 1]} ${r.startYear} – ${r.clampedEndDay} ${MONTHS[r.endMonth - 1]} ${r.endYear}`;
}

module.exports = { calcDeductionAbsent, calcDeductionLate, calcTHP, getPeriodLabel, getPeriodDateRange, getPeriodForDate };
