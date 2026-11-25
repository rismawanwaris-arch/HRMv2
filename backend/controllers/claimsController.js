const { query } = require('../db');
const {
  calcOvertimePay,
  calcTHR,
  calcTHP,
  calcBPJS,
  calcPPh21TER,
  getPeriodDateRange,
  getPeriodForDate,
} = require('../utils/payrollCalc');
const { getSettings } = require('../utils/attendanceSync');
const { cleanupUploadedFiles, verifyImageMagicBytes } = require('../utils/helpers');

function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── Overtime (PP 35/2021) ────────────────────────────────────────────────────

exports.getOvertime = async (req, res) => {
  try {
    const { status, period, employee_id } = req.query;
    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;

    let sql = `
      SELECT o.*, e.name AS employee_name, e.position, e.branch_id, b.name AS branch_name
      FROM overtime_requests o
      JOIN employees e ON o.employee_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND o.status = ?'; params.push(status); }
    if (employee_id) { sql += ' AND o.employee_id = ?'; params.push(parseInt(employee_id, 10)); }
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);
      sql += ' AND o.date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    sql += ' ORDER BY o.date DESC, o.id DESC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (getOvertime):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createOvertime = async (req, res) => {
  try {
    const employeeId = parseInt(req.body.employee_id, 10);
    const { date, hours, day_type = 'weekday', reason = '' } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Tanggal lembur wajib format YYYY-MM-DD.' });
    }
    const hrs = parseFloat(hours);
    if (!Number.isFinite(hrs) || hrs <= 0 || hrs > 24) {
      return res.status(400).json({ success: false, message: 'Durasi lembur harus antara 0.1 hingga 24 jam.' });
    }
    if (!['weekday', 'holiday'].includes(day_type)) {
      return res.status(400).json({ success: false, message: 'Tipe hari harus weekday atau holiday.' });
    }

    const emp = await query.get("SELECT id, name, salary, allowance FROM employees WHERE id = ? AND status = 'Active'", [employeeId]);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan aktif tidak ditemukan.' });

    const settings = await getSettings();
    const divisor = parseInt(settings.overtime_hourly_divisor, 10) || 173;
    const wage = (emp.salary || 0) + (emp.allowance || 0);
    const calculatedAmount = calcOvertimePay(wage, hrs, day_type, divisor);
    const actor = req.user?.username || 'system';

    const result = await query.run(
      `INSERT INTO overtime_requests
       (employee_id, date, hours, day_type, calculated_amount, reason, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [employeeId, date, hrs, day_type, calculatedAmount, reason ? String(reason).trim() : null, actor]
    );
    const created = await query.get(
      `SELECT o.*, e.name AS employee_name, b.name AS branch_name
       FROM overtime_requests o JOIN employees e ON o.employee_id = e.id LEFT JOIN branches b ON e.branch_id = b.id
       WHERE o.id = ?`,
      [result.id]
    );
    res.status(201).json({ success: true, data: created, message: 'Pengajuan lembur berhasil dibuat.' });
  } catch (err) {
    console.error('API Error (createOvertime):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.approveOvertime = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await query.get('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Data lembur tidak ditemukan.' });
    if (row.status !== 'Pending') return res.status(400).json({ success: false, message: `Lembur sudah berstatus ${row.status}.` });

    const actor = req.user?.username || 'system';
    const notes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    await query.run(
      "UPDATE overtime_requests SET status = 'Approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [actor, notes, id]
    );
    const updated = await query.get('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: 'Lembur disetujui.' });
  } catch (err) {
    console.error('API Error (approveOvertime):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.rejectOvertime = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await query.get('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Data lembur tidak ditemukan.' });
    if (row.status !== 'Pending') return res.status(400).json({ success: false, message: `Lembur sudah berstatus ${row.status}.` });

    const actor = req.user?.username || 'system';
    const notes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    await query.run(
      "UPDATE overtime_requests SET status = 'Rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [actor, notes, id]
    );
    const updated = await query.get('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: 'Lembur ditolak.' });
  } catch (err) {
    console.error('API Error (rejectOvertime):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteOvertime = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await query.get('SELECT * FROM overtime_requests WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Data lembur tidak ditemukan.' });
    if (!['Pending', 'Rejected'].includes(row.status)) {
      return res.status(400).json({ success: false, message: 'Lembur yang sudah disetujui tidak dapat dihapus.' });
    }
    await query.run('DELETE FROM overtime_requests WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data lembur dihapus.' });
  } catch (err) {
    console.error('API Error (deleteOvertime):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Reimbursements / Klaim ──────────────────────────────────────────────────

exports.getReimbursements = async (req, res) => {
  try {
    const { status, period, employee_id } = req.query;
    let sql = `
      SELECT r.*, e.name AS employee_name, e.position, e.branch_id, b.name AS branch_name
      FROM reimbursements r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    if (period) { sql += ' AND r.payroll_period = ?'; params.push(period); }
    if (employee_id) { sql += ' AND r.employee_id = ?'; params.push(parseInt(employee_id, 10)); }
    sql += ' ORDER BY r.claim_date DESC, r.id DESC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (getReimbursements):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createReimbursement = async (req, res) => {
  const uploadedFiles = req.file ? [req.file] : [];
  try {
    if (req.file && !verifyImageMagicBytes([req.file])) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'File struk tidak valid. Gunakan gambar JPG, PNG, atau WEBP asli.' });
    }

    const employeeId = parseInt(req.body.employee_id, 10);
    const { claim_date, category, amount, description = '' } = req.body;

    if (!claim_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(claim_date))) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Tanggal klaim wajib format YYYY-MM-DD.' });
    }
    if (!category || !String(category).trim()) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Kategori klaim wajib diisi.' });
    }
    const cleanAmount = Math.round(parseFloat(amount) || 0);
    if (cleanAmount <= 0) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Nominal klaim harus lebih dari 0.' });
    }

    const emp = await query.get("SELECT id FROM employees WHERE id = ? AND status = 'Active'", [employeeId]);
    if (!emp) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({ success: false, message: 'Karyawan aktif tidak ditemukan.' });
    }

    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const suggestedPeriod = getPeriodForDate(claim_date, startDay, endDay);
    const actor = req.user?.username || 'system';

    const result = await query.run(
      `INSERT INTO reimbursements
       (employee_id, claim_date, category, amount, description, receipt_photo, payroll_period, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [
        employeeId,
        claim_date,
        String(category).trim(),
        cleanAmount,
        description ? String(description).trim() : null,
        req.file ? req.file.filename : null,
        suggestedPeriod,
        actor,
      ]
    );
    const created = await query.get(
      `SELECT r.*, e.name AS employee_name, b.name AS branch_name
       FROM reimbursements r JOIN employees e ON r.employee_id = e.id LEFT JOIN branches b ON e.branch_id = b.id
       WHERE r.id = ?`,
      [result.id]
    );
    res.status(201).json({ success: true, data: created, message: 'Klaim reimbursement berhasil diajukan.' });
  } catch (err) {
    cleanupUploadedFiles(uploadedFiles);
    console.error('API Error (createReimbursement):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.approveReimbursement = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await query.get('SELECT * FROM reimbursements WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Klaim tidak ditemukan.' });
    if (row.status !== 'Pending') return res.status(400).json({ success: false, message: `Klaim sudah berstatus ${row.status}.` });

    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const bodyPeriod = req.body.payroll_period && /^\d{4}-\d{2}$/.test(req.body.payroll_period)
      ? req.body.payroll_period
      : (row.payroll_period || getPeriodForDate(row.claim_date, startDay, endDay));

    const actor = req.user?.username || 'system';
    const notes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    await query.run(
      "UPDATE reimbursements SET status = 'Approved', payroll_period = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [bodyPeriod, actor, notes, id]
    );
    const updated = await query.get('SELECT * FROM reimbursements WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: `Klaim disetujui untuk periode payroll ${bodyPeriod}.` });
  } catch (err) {
    console.error('API Error (approveReimbursement):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.rejectReimbursement = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await query.get('SELECT * FROM reimbursements WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Klaim tidak ditemukan.' });
    if (row.status !== 'Pending') return res.status(400).json({ success: false, message: `Klaim sudah berstatus ${row.status}.` });

    const actor = req.user?.username || 'system';
    const notes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    await query.run(
      "UPDATE reimbursements SET status = 'Rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [actor, notes, id]
    );
    const updated = await query.get('SELECT * FROM reimbursements WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: 'Klaim ditolak.' });
  } catch (err) {
    console.error('API Error (rejectReimbursement):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteReimbursement = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await query.get('SELECT * FROM reimbursements WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, message: 'Klaim tidak ditemukan.' });
    if (!['Pending', 'Rejected'].includes(row.status)) {
      return res.status(400).json({ success: false, message: 'Klaim yang sudah disetujui/dibayar tidak dapat dihapus.' });
    }
    await query.run('DELETE FROM reimbursements WHERE id = ?', [id]);
    res.json({ success: true, message: 'Klaim dihapus.' });
  } catch (err) {
    console.error('API Error (deleteReimbursement):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── THR Calculator (Permenaker 6/2016) ───────────────────────────────────────

exports.previewTHR = async (req, res) => {
  try {
    const targetDate = req.query.target_date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.target_date)
      ? req.query.target_date
      : todayLocalStr();

    const emps = await query.all(`
      SELECT e.id, e.name, e.position, e.employee_type, e.hire_date, e.salary, e.allowance,
             e.branch_id, b.name AS branch_name
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.status = 'Active'
      ORDER BY b.name ASC, e.name ASC
    `);

    const items = emps.map((e) => {
      const wage = (e.salary || 0) + (e.allowance || 0);
      const calc = calcTHR(wage, e.hire_date, targetDate);
      return {
        employee_id: e.id,
        employee_name: e.name,
        position: e.position,
        employee_type: e.employee_type,
        branch_id: e.branch_id,
        branch_name: e.branch_name,
        hire_date: e.hire_date,
        base_wage: wage,
        ...calc,
      };
    });
    const totalTHR = items.reduce((s, x) => s + x.amount, 0);
    res.json({ success: true, data: items, target_date: targetDate, total_thr: totalTHR });
  } catch (err) {
    console.error('API Error (previewTHR):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.applyTHR = async (req, res) => {
  try {
    const { period, target_date, employee_ids } = req.body;
    if (!period || !/^\d{4}-\d{2}$/.test(String(period))) {
      return res.status(400).json({ success: false, message: 'Periode payroll wajib format YYYY-MM.' });
    }
    const targetDate = target_date && /^\d{4}-\d{2}-\d{2}$/.test(String(target_date))
      ? target_date
      : todayLocalStr();

    await query.run("INSERT OR IGNORE INTO payroll_periods (period, status) VALUES (?, 'Draft')", [period]);
    const pp = await query.get('SELECT * FROM payroll_periods WHERE period = ?', [period]);
    if (pp.status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Periode payroll sudah dikunci (bukan Draft).' });
    }

    const settings = await getSettings();
    const pph21Global = settings.pph21_payroll_enabled === '1';

    let emps = await query.all(
      "SELECT id, branch_id, employee_type, hire_date, salary, allowance, bpjs_active, enable_bpjs, ptkp_status, enable_pph21 FROM employees WHERE status = 'Active'"
    );
    const bpjsGlobal = settings.bpjs_payroll_enabled === '1';
    if (Array.isArray(employee_ids) && employee_ids.length > 0) {
      const idSet = new Set(employee_ids.map((v) => parseInt(v, 10)));
      emps = emps.filter((e) => idSet.has(e.id));
    }

    let applied = 0;
    await query.run('BEGIN TRANSACTION');
    try {
      for (const emp of emps) {
        const wage = (emp.salary || 0) + (emp.allowance || 0);
        const { amount: thrPay } = calcTHR(wage, emp.hire_date, targetDate);

        const existing = await query.get(
          'SELECT * FROM payroll_entries WHERE payroll_period_id = ? AND employee_id = ?',
          [pp.id, emp.id]
        );
        if (existing) {
          let pph21 = existing.pph21_deduction || 0;
          if (pph21Global && emp.enable_pph21 === 1) {
            const useBpjs = bpjsGlobal && (emp.enable_bpjs === 1 || emp.bpjs_active === 'Aktif');
            const bpjs = useBpjs
              ? calcBPJS((existing.salary || 0) + (existing.allowance || 0), settings)
              : { bpjs_kes_company: 0, bpjs_jkk_company: 0, bpjs_jkm_company: 0 };
            const taxableGross = (existing.salary || 0) + (existing.allowance || 0) +
              (existing.bonus_penjualan || 0) + (existing.bonus_tartun || 0) + (existing.bonus_lain || 0) +
              (existing.overtime_pay || 0) + thrPay +
              bpjs.bpjs_kes_company + bpjs.bpjs_jkk_company + bpjs.bpjs_jkm_company;
            pph21 = calcPPh21TER(taxableGross, emp.ptkp_status).amount;
          }
          const thp = calcTHP({ ...existing, thr_pay: thrPay, pph21_deduction: pph21 });
          await query.run(
            'UPDATE payroll_entries SET thr_pay = ?, pph21_deduction = ?, take_home_pay = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [thrPay, pph21, thp, existing.id]
          );
        } else {
          let pph21 = 0;
          if (pph21Global && emp.enable_pph21 === 1) {
            pph21 = calcPPh21TER(wage + thrPay, emp.ptkp_status).amount;
          }
          const thp = calcTHP({ salary: emp.salary, allowance: emp.allowance, thr_pay: thrPay, pph21_deduction: pph21 });
          await query.run(
            `INSERT INTO payroll_entries
             (payroll_period_id, period, employee_id, branch_id, employee_type, salary, allowance, thr_pay, pph21_deduction, take_home_pay)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pp.id, period, emp.id, emp.branch_id, emp.employee_type, emp.salary, emp.allowance, thrPay, pph21, thp]
          );
        }
        applied++;
      }
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    res.json({ success: true, applied, period, message: `THR berhasil diterapkan ke payroll ${period} untuk ${applied} karyawan.` });
  } catch (err) {
    console.error('API Error (applyTHR):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
