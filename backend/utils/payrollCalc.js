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
 * Employer BPJS contributions (bpjs_kes_company, bpjs_tk_company) are informational only and do not add to THP.
 * @param {object} entry - payroll entry fields
 */
function calcTHP(entry) {
  const gross = (entry.salary || 0) + (entry.allowance || 0);
  const totalBonus =
    (entry.bonus_penjualan || 0) +
    (entry.bonus_tartun || 0) +
    (entry.bonus_lain || 0) +
    (entry.overtime_pay || 0) +
    (entry.reimbursement_pay || 0) +
    (entry.thr_pay || 0);
  const totalDeductions =
    (entry.deduction_kasbon || 0) +
    (entry.deduction_loan || 0) +
    (entry.deduction_absent || 0) +
    (entry.deduction_late || 0) +
    (entry.deduction_fake_money || 0) +
    (entry.bpjs_kes_emp || 0) +
    (entry.bpjs_tk_emp || 0) +
    (entry.pph21_deduction || 0);
  return Math.round(gross + totalBonus - totalDeductions);
}

/**
 * Determine PPh 21 TER Category (PP 58/2023 & PMK 168/2023) from PTKP status.
 * @param {string} ptkpStatus
 * @returns {'A' | 'B' | 'C'}
 */
function getTERCategory(ptkpStatus = 'TK/0') {
  const norm = String(ptkpStatus || 'TK/0').trim().toUpperCase();
  if (norm === 'K/3') return 'C';
  if (['TK/2', 'TK/3', 'K/1', 'K/2'].includes(norm)) return 'B';
  return 'A';
}

// Each tuple is [maxGrossInclusive (Infinity for top bracket), ratePercent]
const TER_BRACKETS = {
  A: [
    [5400000, 0], [5650000, 0.25], [5950000, 0.5], [6300000, 0.75],
    [6750000, 1], [7500000, 1.25], [8550000, 1.5], [9650000, 1.75],
    [10050000, 2], [10350000, 2.25], [10700000, 2.5], [11050000, 3],
    [11600000, 3.5], [12500000, 4], [13750000, 5], [15100000, 6],
    [16950000, 7], [19750000, 8], [24150000, 9], [26450000, 10],
    [28000000, 11], [30050000, 12], [32400000, 13], [35400000, 14],
    [39100000, 15], [43850000, 16], [47800000, 17], [51400000, 18],
    [56300000, 19], [62200000, 20], [68600000, 21], [77500000, 22],
    [89000000, 23], [103000000, 24], [125000000, 25], [157000000, 26],
    [206000000, 27], [337000000, 28], [454000000, 29], [550000000, 30],
    [695000000, 31], [910000000, 32], [1400000000, 33], [Infinity, 34],
  ],
  B: [
    [6200000, 0], [6500000, 0.25], [6850000, 0.5], [7300000, 0.75],
    [9200000, 1], [10750000, 1.5], [11250000, 2], [11600000, 2.5],
    [12600000, 3], [13600000, 4], [14950000, 5], [16400000, 6],
    [18450000, 7], [21850000, 8], [26000000, 9], [27700000, 10],
    [29350000, 11], [31450000, 12], [33950000, 13], [37100000, 14],
    [41000000, 15], [46200000, 16], [50300000, 17], [53800000, 18],
    [58800000, 19], [64600000, 20], [71500000, 21], [80500000, 22],
    [92000000, 23], [107000000, 24], [129000000, 25], [161000000, 26],
    [211000000, 27], [374000000, 28], [463000000, 29], [560000000, 30],
    [705000000, 31], [940000000, 32], [1419000000, 33], [Infinity, 34],
  ],
  C: [
    [6600000, 0], [6950000, 0.25], [7350000, 0.5], [7800000, 0.75],
    [8850000, 1], [9800000, 1.25], [10950000, 1.5], [11200000, 1.75],
    [12050000, 2], [12950000, 3], [14150000, 4], [15550000, 5],
    [17050000, 6], [19500000, 7], [22700000, 8], [26600000, 9],
    [28100000, 10], [30100000, 11], [32600000, 12], [35400000, 13],
    [38900000, 14], [43000000, 15], [47400000, 16], [51200000, 17],
    [55000000, 18], [60100000, 19], [66000000, 20], [73000000, 21],
    [82000000, 22], [93000000, 23], [109000000, 24], [129000000, 25],
    [164000000, 26], [214000000, 27], [376000000, 28], [470000000, 29],
    [565000000, 30], [710000000, 31], [965000000, 32], [1419000000, 33],
    [Infinity, 34],
  ],
};

/**
 * Calculate monthly PPh 21 using PP 58/2023 TER tables.
 * @param {number} grossMonthly
 * @param {string} [ptkpStatus='TK/0']
 * @returns {{ category: 'A'|'B'|'C', rate: number, amount: number }}
 */
function calcPPh21TER(grossMonthly, ptkpStatus = 'TK/0') {
  const category = getTERCategory(ptkpStatus);
  const gross = Number(grossMonthly) || 0;
  if (gross <= 0) return { category, rate: 0, amount: 0 };
  const table = TER_BRACKETS[category];
  const matched = table.find(([maxGross]) => gross <= maxGross) || table[table.length - 1];
  const rate = matched[1];
  return { category, rate, amount: Math.round(gross * (rate / 100)) };
}

/**
 * Calculate BPJS Kesehatan & BPJS Ketenagakerjaan contributions.
 * @param {number} baseWage - Salary + fixed allowance
 * @param {object} [settings={}] - Configurable system_settings key-value map
 */
function calcBPJS(baseWage, settings = {}) {
  const wage = Math.max(0, Number(baseWage) || 0);
  if (wage <= 0) {
    return {
      bpjs_kes_emp: 0, bpjs_kes_company: 0,
      bpjs_jht_emp: 0, bpjs_jp_emp: 0, bpjs_tk_emp: 0,
      bpjs_jkk_company: 0, bpjs_jkm_company: 0, bpjs_tk_company: 0,
    };
  }
  const numSetting = (k, def) => {
    const v = parseFloat(settings[k]);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  const kesCap = numSetting('bpjs_kes_cap', 12000000);
  const jpCap = numSetting('bpjs_jp_cap', 10547400);

  const kesBase = Math.min(wage, kesCap);
  const jpBase = Math.min(wage, jpCap);

  const bpjs_kes_emp = Math.round(kesBase * (numSetting('bpjs_kes_emp_rate', 1) / 100));
  const bpjs_kes_company = Math.round(kesBase * (numSetting('bpjs_kes_company_rate', 4) / 100));

  const bpjs_jht_emp = Math.round(wage * (numSetting('bpjs_jht_emp_rate', 2) / 100));
  const bpjs_jp_emp = Math.round(jpBase * (numSetting('bpjs_jp_emp_rate', 1) / 100));
  const bpjs_tk_emp = bpjs_jht_emp + bpjs_jp_emp;

  const jhtCompany = Math.round(wage * (numSetting('bpjs_jht_company_rate', 3.7) / 100));
  const jpCompany = Math.round(jpBase * (numSetting('bpjs_jp_company_rate', 2) / 100));
  const bpjs_jkk_company = Math.round(wage * (numSetting('bpjs_jkk_rate', 0.24) / 100));
  const bpjs_jkm_company = Math.round(wage * (numSetting('bpjs_jkm_rate', 0.3) / 100));
  const bpjs_tk_company = jhtCompany + jpCompany + bpjs_jkk_company + bpjs_jkm_company;

  return {
    bpjs_kes_emp, bpjs_kes_company,
    bpjs_jht_emp, bpjs_jp_emp, bpjs_tk_emp,
    bpjs_jkk_company, bpjs_jkm_company, bpjs_tk_company,
  };
}

/**
 * Calculate Overtime pay per PP 35/2021 rules.
 * - Weekday: first hour 1.5x, remaining hours 2x.
 * - Holiday: first 7 hours 2x, 8th hour 3x, >8 hours 4x.
 * @param {number} monthlyWage
 * @param {number} hours
 * @param {'weekday'|'holiday'} [dayType='weekday']
 * @param {number} [hourlyDivisor=173]
 */
function calcOvertimePay(monthlyWage, hours, dayType = 'weekday', hourlyDivisor = 173) {
  const wage = Math.max(0, Number(monthlyWage) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const divisor = Math.max(1, Number(hourlyDivisor) || 173);
  if (wage <= 0 || h <= 0) return 0;

  const hourlyRate = wage / divisor;
  let multiplierHours = 0;
  if (dayType === 'holiday') {
    const tier1 = Math.min(h, 7);
    const tier2 = Math.min(Math.max(h - 7, 0), 1);
    const tier3 = Math.max(h - 8, 0);
    multiplierHours = tier1 * 2 + tier2 * 3 + tier3 * 4;
  } else {
    const tier1 = Math.min(h, 1);
    const tier2 = Math.max(h - 1, 0);
    multiplierHours = tier1 * 1.5 + tier2 * 2;
  }
  return Math.round(hourlyRate * multiplierHours);
}

/**
 * Calculate THR per Permenaker 6/2016:
 * - >= 12 months service: 100% monthly wage
 * - 1..11 completed months: (months / 12) * monthly wage
 * - < 1 month: 0
 * @param {number} monthlyWage
 * @param {string} hireDateStr
 * @param {string} targetDateStr
 */
function calcTHR(monthlyWage, hireDateStr, targetDateStr) {
  const wage = Math.max(0, Number(monthlyWage) || 0);
  if (!hireDateStr || !targetDateStr || wage <= 0) {
    return { months_of_service: 0, ratio: 0, amount: 0 };
  }
  const start = new Date(`${String(hireDateStr).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(targetDateStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { months_of_service: 0, ratio: 0, amount: 0 };
  }

  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  months = Math.max(0, months);

  if (months < 1) {
    return { months_of_service: 0, ratio: 0, amount: 0 };
  }
  const ratio = months >= 12 ? 1 : months / 12;
  return {
    months_of_service: months,
    ratio: Number(ratio.toFixed(4)),
    amount: Math.round(wage * ratio),
  };
}

/**
 * Haversine geodesic distance in meters between two GPS points.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
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

module.exports = {
  calcDeductionAbsent,
  calcDeductionLate,
  calcTHP,
  getTERCategory,
  calcPPh21TER,
  calcBPJS,
  calcOvertimePay,
  calcTHR,
  haversineMeters,
  getPeriodLabel,
  getPeriodDateRange,
  getPeriodForDate,
};
