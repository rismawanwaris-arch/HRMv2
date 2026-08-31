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

/**
 * Format period YYYY-MM into a human-readable range label.
 * period = "2026-07", startDay=29, endDay=28
 * → "29 Juni 2026 – 28 Juli 2026"
 */
function getPeriodLabel(period, startDay = 29, endDay = 28) {
  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const [year, month] = period.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${startDay} ${MONTHS[prevMonth - 1]} ${prevYear} – ${endDay} ${MONTHS[month - 1]} ${year}`;
}

module.exports = { calcDeductionAbsent, calcDeductionLate, calcTHP, getPeriodLabel };
