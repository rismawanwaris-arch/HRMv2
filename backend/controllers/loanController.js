const { query } = require('../db');

function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

exports.getAll = async (req, res) => {
  try {
    const { status, employee_id, branch_id } = req.query;
    let sql = `
      SELECT l.*, e.name AS employee_name, e.position, e.employee_type, e.branch_id,
             b.name AS branch_name,
             (SELECT COUNT(*) FROM loan_payments lp WHERE lp.loan_id = l.id) AS payment_count
      FROM employee_loans l
      JOIN employees e ON l.employee_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND l.status = ?'; params.push(status); }
    if (employee_id) { sql += ' AND l.employee_id = ?'; params.push(parseInt(employee_id, 10)); }
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(parseInt(branch_id, 10)); }
    sql += " ORDER BY CASE WHEN l.status = 'Active' THEN 0 ELSE 1 END, l.created_at DESC, l.id DESC";

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (loans getAll):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const stats = await query.get(`
      SELECT
        COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_count,
        COALESCE(SUM(CASE WHEN status = 'Active' THEN remaining_amount ELSE 0 END), 0) AS total_remaining,
        COALESCE(SUM(CASE WHEN status = 'Active' THEN MIN(monthly_installment, remaining_amount) ELSE 0 END), 0) AS est_monthly_installment,
        COUNT(CASE WHEN status = 'Paid Off' THEN 1 END) AS paid_off_count,
        COALESCE(SUM(principal_amount), 0) AS total_disbursed
      FROM employee_loans
    `);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('API Error (loans getSummary):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const loan = await query.get(
      `SELECT l.*, e.name AS employee_name, e.position, b.name AS branch_name
       FROM employee_loans l
       JOIN employees e ON l.employee_id = e.id
       LEFT JOIN branches b ON e.branch_id = b.id
       WHERE l.id = ?`,
      [id]
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });
    const payments = await query.all(
      'SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC',
      [id]
    );
    res.json({ success: true, data: { ...loan, payments } });
  } catch (err) {
    console.error('API Error (loans getById):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.create = async (req, res) => {
  try {
    const employeeId = parseInt(req.body.employee_id, 10);
    const {
      loan_type = 'Kasbon',
      principal_amount,
      tenor_months = 1,
      monthly_installment,
      start_period,
      notes = '',
    } = req.body;

    const emp = await query.get("SELECT id, name FROM employees WHERE id = ? AND status = 'Active'", [employeeId]);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan aktif tidak ditemukan.' });

    const principal = Math.round(parseFloat(principal_amount) || 0);
    const tenor = parseInt(tenor_months, 10);
    if (principal <= 0) return res.status(400).json({ success: false, message: 'Nominal pinjaman harus lebih dari 0.' });
    if (Number.isNaN(tenor) || tenor < 1 || tenor > 120) {
      return res.status(400).json({ success: false, message: 'Tenor harus antara 1 sampai 120 bulan.' });
    }
    if (!start_period || !/^\d{4}-\d{2}$/.test(String(start_period))) {
      return res.status(400).json({ success: false, message: 'Periode mulai cicilan wajib format YYYY-MM.' });
    }

    const customInst = monthly_installment !== undefined && monthly_installment !== ''
      ? Math.round(parseFloat(monthly_installment) || 0)
      : 0;
    const installment = customInst > 0 ? Math.min(principal, customInst) : Math.ceil(principal / tenor);

    const actor = req.user?.username || 'system';
    const result = await query.run(
      `INSERT INTO employee_loans
       (employee_id, loan_type, principal_amount, tenor_months, monthly_installment, remaining_amount, start_period, status, notes, approved_by, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)`,
      [employeeId, String(loan_type || 'Kasbon').trim(), principal, tenor, installment, principal, start_period, notes ? String(notes).trim() : null, actor, actor]
    );
    const created = await query.get(
      `SELECT l.*, e.name AS employee_name, b.name AS branch_name
       FROM employee_loans l JOIN employees e ON l.employee_id = e.id LEFT JOIN branches b ON e.branch_id = b.id
       WHERE l.id = ?`,
      [result.id]
    );
    res.status(201).json({ success: true, data: created, message: 'Pinjaman / kasbon berjangka berhasil dicatat.' });
  } catch (err) {
    console.error('API Error (loans create):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const loan = await query.get('SELECT * FROM employee_loans WHERE id = ?', [id]);
    if (!loan) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });
    if (loan.status !== 'Active') {
      return res.status(400).json({ success: false, message: `Pinjaman berstatus ${loan.status} tidak dapat menerima pembayaran.` });
    }

    const amount = Math.round(parseFloat(req.body.amount) || 0);
    if (amount <= 0) return res.status(400).json({ success: false, message: 'Nominal pembayaran harus lebih dari 0.' });
    if (amount > loan.remaining_amount) {
      return res.status(400).json({ success: false, message: 'Nominal pembayaran melebihi sisa pinjaman.' });
    }

    const paymentDate = req.body.payment_date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.payment_date)
      ? req.body.payment_date
      : todayLocalStr();
    const method = req.body.payment_method ? String(req.body.payment_method).trim() : 'Tunai';
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const actor = req.user?.username || 'system';
    const nextRemaining = Math.max(0, loan.remaining_amount - amount);
    const nextStatus = nextRemaining <= 0 ? 'Paid Off' : 'Active';

    await query.run('BEGIN TRANSACTION');
    try {
      await query.run(
        `INSERT INTO loan_payments (loan_id, employee_id, period, amount, payment_date, payment_method, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, loan.employee_id, paymentDate.slice(0, 7), amount, paymentDate, method, notes, actor]
      );
      await query.run(
        'UPDATE employee_loans SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextRemaining, nextStatus, id]
      );
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    const updated = await query.get('SELECT * FROM employee_loans WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: nextStatus === 'Paid Off' ? 'Pembayaran dicatat — Pinjaman LUNAS.' : 'Pembayaran pinjaman berhasil dicatat.' });
  } catch (err) {
    console.error('API Error (loans recordPayment):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.cancel = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const loan = await query.get('SELECT * FROM employee_loans WHERE id = ?', [id]);
    if (!loan) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });
    if (loan.status !== 'Active') {
      return res.status(400).json({ success: false, message: `Pinjaman sudah berstatus ${loan.status}.` });
    }
    await query.run(
      "UPDATE employee_loans SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    res.json({ success: true, message: 'Pinjaman dibatalkan.' });
  } catch (err) {
    console.error('API Error (loans cancel):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
