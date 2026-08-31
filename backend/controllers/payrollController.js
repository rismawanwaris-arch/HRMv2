const { query } = require('../db');
const { calcTHP, getPeriodLabel } = require('../utils/payrollCalc');

async function getSettings() {
  const rows = await query.all('SELECT key, value FROM system_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function getOrCreatePeriod(period) {
  let pp = await query.get('SELECT * FROM payroll_periods WHERE period = ?', [period]);
  if (!pp) {
    const res = await query.run(
      "INSERT INTO payroll_periods (period, status) VALUES (?, 'Draft')",
      [period]
    );
    pp = await query.get('SELECT * FROM payroll_periods WHERE id = ?', [res.id]);
  }
  return pp;
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

    const employees = await query.all(
      "SELECT id, branch_id, employee_type, salary, allowance FROM employees WHERE status = 'Active'"
    );

    let created = 0, updated = 0;
    for (const emp of employees) {
      const att = await query.get(
        'SELECT * FROM attendance_records WHERE employee_id = ? AND period = ?',
        [emp.id, period]
      );

      const deduction_kasbon = att ? att.cash_advance : 0;
      const deduction_absent = att ? att.deduction_absent : 0;
      const deduction_late = att ? att.deduction_late : 0;
      const deduction_fake_money = att ? att.fake_money : 0;

      const existing = await query.get(
        'SELECT * FROM payroll_entries WHERE payroll_period_id = ? AND employee_id = ?',
        [pp.id, emp.id]
      );

      if (existing) {
        const thp = calcTHP({ ...existing, salary: emp.salary, allowance: emp.allowance, deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money });
        await query.run(
          `UPDATE payroll_entries SET
            salary=?, allowance=?, employee_type=?,
            deduction_kasbon=?, deduction_absent=?, deduction_late=?, deduction_fake_money=?,
            take_home_pay=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
          [emp.salary, emp.allowance, emp.employee_type, deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money, thp, existing.id]
        );
        updated++;
      } else {
        const thp = calcTHP({ salary: emp.salary, allowance: emp.allowance, bonus_penjualan: 0, bonus_tartun: 0, bonus_lain: 0, deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money });
        await query.run(
          `INSERT INTO payroll_entries
            (payroll_period_id, period, employee_id, branch_id, employee_type,
             salary, allowance, deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money, take_home_pay)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [pp.id, period, emp.id, emp.branch_id, emp.employee_type, emp.salary, emp.allowance, deduction_kasbon, deduction_absent, deduction_late, deduction_fake_money, thp]
        );
        created++;
      }
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
    const id = parseInt(req.params.id);
    const entry = await query.get('SELECT * FROM payroll_entries pe JOIN payroll_periods pp ON pe.payroll_period_id=pp.id WHERE pe.id=?', [id]);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry tidak ditemukan.' });
    if (entry.status !== 'Draft') return res.status(400).json({ success: false, message: 'Payroll sudah dikunci.' });

    const { bonus_penjualan, bonus_tartun, bonus_lain, bonus_lain_label, bonus_ditahan, notes } = req.body;

    const updated = {
      ...entry,
      bonus_penjualan: parseFloat(bonus_penjualan) || entry.bonus_penjualan,
      bonus_tartun: parseFloat(bonus_tartun) || entry.bonus_tartun,
      bonus_lain: parseFloat(bonus_lain) || entry.bonus_lain,
      bonus_lain_label: bonus_lain_label !== undefined ? bonus_lain_label : entry.bonus_lain_label,
      bonus_ditahan: parseFloat(bonus_ditahan) || entry.bonus_ditahan,
      notes: notes !== undefined ? notes : entry.notes,
    };
    updated.take_home_pay = calcTHP(updated);

    await query.run(
      `UPDATE payroll_entries SET
        bonus_penjualan=?, bonus_tartun=?, bonus_lain=?, bonus_lain_label=?,
        bonus_ditahan=?, notes=?, take_home_pay=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [updated.bonus_penjualan, updated.bonus_tartun, updated.bonus_lain, updated.bonus_lain_label,
       updated.bonus_ditahan, updated.notes, updated.take_home_pay, id]
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
    const id = parseInt(req.params.id);
    const entry = await query.get(`
      SELECT pe.*,
        e.name AS employee_name, e.position, e.phone, e.bank_name, e.bank_account,
        b.name AS branch_name, b.code AS branch_code
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      LEFT JOIN branches b ON pe.branch_id = b.id
      WHERE pe.id = ?
    `, [id]);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry tidak ditemukan.' });

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
    if (!pp) return res.json({ success: true, data: [], total_thp: 0 });

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
    await query.run(
      "UPDATE payroll_periods SET status='Submitted', submitted_at=CURRENT_TIMESTAMP, submitted_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [actor, pp.id]
    );
    res.json({ success: true, message: 'Payroll berhasil diajukan ke owner.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
