const { query } = require('../db');
const { calcTHP, calcBPJS, calcPPh21TER, getPeriodDateRange, getPeriodLabel } = require('../utils/payrollCalc');
const { decryptRow } = require('../utils/fieldCrypto');

function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const numOr = (val, fallback) => {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

async function getSettings() {
  const rows = await query.all('SELECT key, value FROM system_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function getOrCreatePeriod(period) {
  await query.run(
    "INSERT OR IGNORE INTO payroll_periods (period, status) VALUES (?, 'Draft')",
    [period]
  );
  return query.get('SELECT * FROM payroll_periods WHERE period = ?', [period]);
}

/**
 * GET /api/payroll/periods
 * List all payroll periods with entry count.
 */
exports.listPeriods = async (req, res) => {
  try {
    const rows = await query.all(`
      SELECT pp.*,
        (SELECT COUNT(*) FROM payroll_entries pe WHERE pe.payroll_period_id = pp.id) AS entry_count,
        (SELECT COALESCE(SUM(pe.take_home_pay),0) FROM payroll_entries pe WHERE pe.payroll_period_id = pp.id) AS total_thp
      FROM payroll_periods pp
      ORDER BY pp.period DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/payroll/periods/:period/generate
 * Auto-generate (or refresh) payroll entries for all active employees in the period.
 * Pulls salary/allowance from employees; deductions from attendance_records.
 * Existing bonus fields are NOT overwritten.
 */
exports.generateEntries = async (req, res) => {
  try {
    const { period } = req.params;
    if (!/^\d{4}-\d{2}$/.test(period))
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });

    const pp = await getOrCreatePeriod(period);
    if (pp.status !== 'Draft')
      return res.status(400).json({ success: false, message: 'Payroll sudah dikunci (bukan Draft).' });

    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);
    const bpjsGlobal = settings.bpjs_payroll_enabled === '1';
    const pph21Global = settings.pph21_payroll_enabled === '1';

    const employees = await query.all(
      "SELECT id, branch_id, employee_type, salary, allowance, ptkp_status, bpjs_active, enable_bpjs, enable_pph21 FROM employees WHERE status = 'Active'"
    );

    let created = 0, updated = 0;
    await query.run('BEGIN TRANSACTION');
    try {
      for (const emp of employees) {
        const att = await query.get(
          'SELECT * FROM attendance_records WHERE employee_id = ? AND period = ?',
          [emp.id, period]
        );

        const deduction_kasbon = att ? att.cash_advance : 0;
        const deduction_absent = att ? att.deduction_absent : 0;
        const deduction_late = att ? att.deduction_late : 0;
        const deduction_fake_money = att ? att.fake_money : 0;

        const otRow = await query.get(
          "SELECT COALESCE(SUM(calculated_amount), 0) AS total FROM overtime_requests WHERE employee_id = ? AND status = 'Approved' AND date BETWEEN ? AND ?",
          [emp.id, startDate, endDate]
        );
        const overtime_pay = otRow ? Math.round(otRow.total || 0) : 0;

        const reimbRow = await query.get(
          "SELECT COALESCE(SUM(amount), 0) AS total FROM reimbursements WHERE employee_id = ? AND status IN ('Approved', 'Paid') AND payroll_period = ?",
          [emp.id, period]
        );
        const reimbursement_pay = reimbRow ? Math.round(reimbRow.total || 0) : 0;

        const paidLoanRow = await query.get(
          "SELECT COALESCE(SUM(amount), 0) AS paid FROM loan_payments WHERE employee_id = ? AND period = ? AND payment_method = 'Potong Gaji'",
          [emp.id, period]
        );
        let deduction_loan = 0;
        if (paidLoanRow && paidLoanRow.paid > 0) {
          deduction_loan = Math.round(paidLoanRow.paid);
        } else {
          const dueLoanRow = await query.get(
            "SELECT COALESCE(SUM(MIN(monthly_installment, remaining_amount)), 0) AS due FROM employee_loans WHERE employee_id = ? AND status = 'Active' AND remaining_amount > 0 AND start_period <= ?",
            [emp.id, period]
          );
          deduction_loan = dueLoanRow ? Math.round(dueLoanRow.due || 0) : 0;
        }

        const existing = await query.get(
          'SELECT * FROM payroll_entries WHERE payroll_period_id = ? AND employee_id = ?',
          [pp.id, emp.id]
        );

        const bonus_penjualan = existing ? (existing.bonus_penjualan || 0) : 0;
        const bonus_tartun = existing ? (existing.bonus_tartun || 0) : 0;
        const bonus_lain = existing ? (existing.bonus_lain || 0) : 0;
        const thr_pay = existing ? (existing.thr_pay || 0) : 0;

        const baseWage = (emp.salary || 0) + (emp.allowance || 0);
        const useBpjs = bpjsGlobal && (emp.enable_bpjs === 1 || emp.bpjs_active === 'Aktif');
        const bpjs = useBpjs
          ? calcBPJS(baseWage, settings)
          : { bpjs_kes_emp: 0, bpjs_tk_emp: 0, bpjs_kes_company: 0, bpjs_jkk_company: 0, bpjs_jkm_company: 0, bpjs_tk_company: 0 };

        const usePph = pph21Global && emp.enable_pph21 === 1;
        let pph21_deduction = 0;
        if (usePph) {
          const taxableGross =
            baseWage +
            bonus_penjualan +
            bonus_tartun +
            bonus_lain +
            overtime_pay +
            thr_pay +
            bpjs.bpjs_kes_company +
            bpjs.bpjs_jkk_company +
            bpjs.bpjs_jkm_company;
          pph21_deduction = calcPPh21TER(taxableGross, emp.ptkp_status).amount;
        }

        const calcPayload = {
          salary: emp.salary,
          allowance: emp.allowance,
          bonus_penjualan,
          bonus_tartun,
          bonus_lain,
          overtime_pay,
          reimbursement_pay,
          thr_pay,
          deduction_kasbon,
          deduction_loan,
          deduction_absent,
          deduction_late,
          deduction_fake_money,
          bpjs_kes_emp: bpjs.bpjs_kes_emp,
          bpjs_tk_emp: bpjs.bpjs_tk_emp,
          pph21_deduction,
        };
        const thp = calcTHP(calcPayload);

        if (existing) {
          await query.run(
            `UPDATE payroll_entries SET
              branch_id=?, salary=?, allowance=?, employee_type=?,
              overtime_pay=?, reimbursement_pay=?, thr_pay=?,
              deduction_kasbon=?, deduction_loan=?, deduction_absent=?, deduction_late=?, deduction_fake_money=?,
              bpjs_kes_emp=?, bpjs_tk_emp=?, bpjs_kes_company=?, bpjs_tk_company=?, pph21_deduction=?,
              take_home_pay=?, updated_at=CURRENT_TIMESTAMP
             WHERE id=?`,
            [
              emp.branch_id, emp.salary, emp.allowance, emp.employee_type,
              overtime_pay, reimbursement_pay, thr_pay,
              deduction_kasbon, deduction_loan, deduction_absent, deduction_late, deduction_fake_money,
              bpjs.bpjs_kes_emp, bpjs.bpjs_tk_emp, bpjs.bpjs_kes_company, bpjs.bpjs_tk_company, pph21_deduction,
              thp, existing.id,
            ]
          );
          updated++;
        } else {
          await query.run(
            `INSERT INTO payroll_entries
              (payroll_period_id, period, employee_id, branch_id, employee_type,
               salary, allowance, overtime_pay, reimbursement_pay, thr_pay,
               deduction_kasbon, deduction_loan, deduction_absent, deduction_late, deduction_fake_money,
               bpjs_kes_emp, bpjs_tk_emp, bpjs_kes_company, bpjs_tk_company, pph21_deduction, take_home_pay)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              pp.id, period, emp.id, emp.branch_id, emp.employee_type,
              emp.salary, emp.allowance, overtime_pay, reimbursement_pay, thr_pay,
              deduction_kasbon, deduction_loan, deduction_absent, deduction_late, deduction_fake_money,
              bpjs.bpjs_kes_emp, bpjs.bpjs_tk_emp, bpjs.bpjs_kes_company, bpjs.bpjs_tk_company, pph21_deduction, thp,
            ]
          );
          created++;
        }
      }
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    res.json({ success: true, message: `Payroll di-generate: ${created} baru, ${updated} diperbarui.`, created, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/payroll/periods/:period/entries?employee_type=&branch_id=
 * Get all entries for a period, joined with employee and branch data.
 */
exports.getEntries = async (req, res) => {
  try {
    const { period } = req.params;
    const { employee_type, branch_id } = req.query;

    const pp = await query.get('SELECT * FROM payroll_periods WHERE period = ?', [period]);
    if (!pp) return res.json({ success: true, data: [], period_info: null });

    let sql = `
      SELECT pe.*,
        e.name AS employee_name, e.position, e.phone,
        b.name AS branch_name, b.code AS branch_code
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      LEFT JOIN branches b ON pe.branch_id = b.id
      WHERE pe.payroll_period_id = ?
    `;
    const params = [pp.id];
    if (employee_type) { sql += ' AND pe.employee_type = ?'; params.push(employee_type); }
    if (branch_id) { sql += ' AND pe.branch_id = ?'; params.push(branch_id); }
    sql += ' ORDER BY b.name ASC, e.name ASC';

    const entries = await query.all(sql, params);
    const settings = await getSettings();
    const label = getPeriodLabel(period, parseInt(settings.payroll_period_start_day) || 29, parseInt(settings.payroll_period_end_day) || 28);

    res.json({ success: true, data: entries, period_info: { ...pp, label } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/payroll/entries/:id
 * Update bonus fields (and optionally notes) for one entry, recalculate THP.
 */
exports.updateEntry = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await query.get(
      'SELECT pe.*, pp.status AS period_status FROM payroll_entries pe JOIN payroll_periods pp ON pe.payroll_period_id = pp.id WHERE pe.id = ?',
      [id]
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry tidak ditemukan.' });
    if (entry.period_status !== 'Draft') return res.status(400).json({ success: false, message: 'Payroll sudah dikunci.' });

    const { bonus_penjualan, bonus_tartun, bonus_lain, bonus_lain_label, bonus_ditahan, thr_pay, notes } = req.body;

    const updated = {
      ...entry,
      bonus_penjualan: numOr(bonus_penjualan, entry.bonus_penjualan),
      bonus_tartun: numOr(bonus_tartun, entry.bonus_tartun),
      bonus_lain: numOr(bonus_lain, entry.bonus_lain),
      bonus_lain_label: bonus_lain_label !== undefined ? bonus_lain_label : entry.bonus_lain_label,
      bonus_ditahan: numOr(bonus_ditahan, entry.bonus_ditahan),
      thr_pay: numOr(thr_pay, entry.thr_pay || 0),
      notes: notes !== undefined ? notes : entry.notes,
    };

    const settings = await getSettings();
    const emp = await query.get('SELECT salary, allowance, bpjs_active, enable_bpjs, ptkp_status, enable_pph21 FROM employees WHERE id = ?', [entry.employee_id]);
    if (settings.pph21_payroll_enabled === '1' && emp && emp.enable_pph21 === 1) {
      const bpjsGlobal = settings.bpjs_payroll_enabled === '1';
      const useBpjs = bpjsGlobal && (emp.enable_bpjs === 1 || emp.bpjs_active === 'Aktif');
      const bpjs = useBpjs
        ? calcBPJS((updated.salary || 0) + (updated.allowance || 0), settings)
        : { bpjs_kes_company: 0, bpjs_jkk_company: 0, bpjs_jkm_company: 0 };
      const taxableGross =
        (updated.salary || 0) +
        (updated.allowance || 0) +
        (updated.bonus_penjualan || 0) +
        (updated.bonus_tartun || 0) +
        (updated.bonus_lain || 0) +
        (updated.overtime_pay || 0) +
        (updated.thr_pay || 0) +
        bpjs.bpjs_kes_company +
        bpjs.bpjs_jkk_company +
        bpjs.bpjs_jkm_company;
      updated.pph21_deduction = calcPPh21TER(taxableGross, emp.ptkp_status).amount;
    }

    updated.take_home_pay = calcTHP(updated);

    await query.run(
      `UPDATE payroll_entries SET
        bonus_penjualan=?, bonus_tartun=?, bonus_lain=?, bonus_lain_label=?,
        bonus_ditahan=?, thr_pay=?, pph21_deduction=?, notes=?, take_home_pay=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [updated.bonus_penjualan, updated.bonus_tartun, updated.bonus_lain, updated.bonus_lain_label,
       updated.bonus_ditahan, updated.thr_pay, updated.pph21_deduction || 0, updated.notes, updated.take_home_pay, id]
    );

    const saved = await query.get('SELECT * FROM payroll_entries WHERE id=?', [id]);
    res.json({ success: true, data: saved, message: 'Entry payroll disimpan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/payroll/entries/:id/slip
 * Get full slip data for printing.
 */
exports.getSlip = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await query.get(`
      SELECT pe.*,
        e.name AS employee_name, e.position, e.phone, e.bank_name, e.bank_account, e.ptkp_status,
        b.name AS branch_name, b.code AS branch_code
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      LEFT JOIN branches b ON pe.branch_id = b.id
      WHERE pe.id = ?
    `, [id]);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry tidak ditemukan.' });

    decryptRow(entry);
    const settings = await getSettings();
    const label = getPeriodLabel(entry.period, parseInt(settings.payroll_period_start_day) || 29, parseInt(settings.payroll_period_end_day) || 28);

    res.json({ success: true, data: { ...entry, period_label: label } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/payroll/periods/:period/summary
 * Aggregate totals grouped by branch and employee_type for rekap.
 */
exports.getSummary = async (req, res) => {
  try {
    const { period } = req.params;
    const pp = await query.get('SELECT * FROM payroll_periods WHERE period = ?', [period]);
    if (!pp) return res.json({ success: true, data: [], grand_total: 0, period_info: null });

    const byBranch = await query.all(`
      SELECT pe.employee_type, pe.branch_id, b.name AS branch_name, b.code AS branch_code,
        COUNT(*) AS headcount,
        COALESCE(SUM(pe.take_home_pay),0) AS total_thp
      FROM payroll_entries pe
      LEFT JOIN branches b ON pe.branch_id = b.id
      WHERE pe.payroll_period_id = ?
      GROUP BY pe.branch_id, pe.employee_type
      ORDER BY b.name ASC
    `, [pp.id]);

    const total = await query.get(
      'SELECT COALESCE(SUM(take_home_pay),0) AS grand_total FROM payroll_entries WHERE payroll_period_id=?',
      [pp.id]
    );

    const settings = await getSettings();
    const label = getPeriodLabel(period, parseInt(settings.payroll_period_start_day) || 29, parseInt(settings.payroll_period_end_day) || 28);

    res.json({ success: true, data: byBranch, grand_total: total.grand_total, period_info: { ...pp, label } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/payroll/periods/:period/submit
 * Submit payroll for owner approval.
 */
exports.submitPeriod = async (req, res) => {
  try {
    const { period } = req.params;
    const pp = await query.get('SELECT * FROM payroll_periods WHERE period = ?', [period]);
    if (!pp) return res.status(404).json({ success: false, message: 'Periode tidak ditemukan.' });
    if (pp.status !== 'Draft') return res.status(400).json({ success: false, message: 'Payroll sudah diajukan.' });

    const actor = req.user?.username || 'system';
    const payDate = todayLocalStr();

    await query.run('BEGIN TRANSACTION');
    try {
      await query.run(
        "UPDATE payroll_periods SET status='Submitted', submitted_at=CURRENT_TIMESTAMP, submitted_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [actor, pp.id]
      );

      // Record installment payments for employee loans automatically upon payroll lock
      const loanEntries = await query.all(
        'SELECT id, employee_id, deduction_loan FROM payroll_entries WHERE payroll_period_id = ? AND deduction_loan > 0',
        [pp.id]
      );
      for (const entry of loanEntries) {
        let remainingToPay = entry.deduction_loan;
        const activeLoans = await query.all(
          "SELECT * FROM employee_loans WHERE employee_id = ? AND status = 'Active' AND remaining_amount > 0 AND start_period <= ? ORDER BY start_period ASC, id ASC",
          [entry.employee_id, period]
        );
        for (const loan of activeLoans) {
          if (remainingToPay <= 0) break;
          const alreadyPaid = await query.get(
            "SELECT id FROM loan_payments WHERE loan_id = ? AND period = ? AND payment_method = 'Potong Gaji'",
            [loan.id, period]
          );
          if (alreadyPaid) continue;

          const payAmt = Math.min(remainingToPay, loan.monthly_installment, loan.remaining_amount);
          if (payAmt <= 0) continue;

          await query.run(
            `INSERT INTO loan_payments
             (loan_id, employee_id, period, payroll_entry_id, amount, payment_date, payment_method, notes, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, 'Potong Gaji', ?, ?)`,
            [loan.id, entry.employee_id, period, entry.id, payAmt, payDate, `Cicilan payroll ${period}`, actor]
          );
          const nextRemaining = Math.max(0, loan.remaining_amount - payAmt);
          const nextStatus = nextRemaining <= 0 ? 'Paid Off' : 'Active';
          await query.run(
            'UPDATE employee_loans SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nextRemaining, nextStatus, loan.id]
          );
          remainingToPay -= payAmt;
        }
      }

      // Mark approved reimbursements for this period as Paid
      await query.run(
        "UPDATE reimbursements SET status = 'Paid', updated_at = CURRENT_TIMESTAMP WHERE payroll_period = ? AND status = 'Approved'",
        [period]
      );

      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    res.json({ success: true, message: 'Payroll berhasil diajukan ke owner (cicilan pinjaman & klaim telah dicatat).' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
