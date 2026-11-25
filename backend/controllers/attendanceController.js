const { query } = require('../db');
const { getPeriodDateRange, getPeriodForDate, getPeriodLabel } = require('../utils/payrollCalc');
const {
  getSettings,
  getPenaltyRules,
  normalizeTimeHHMM,
  computeStatus,
  syncEmployeePeriod,
} = require('../utils/attendanceSync');

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
             d.id AS record_id, d.shift, d.check_in_time, d.status, d.is_late, d.notes,
             d.checkin_lat, d.checkin_lng, d.checkin_distance_m, d.checkin_photo
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN daily_attendance d ON d.employee_id = e.id AND d.date = ?
      WHERE e.status = 'Active'
    `;
    const params = [date];
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(branch_id); }
    sql += ' ORDER BY b.name ASC, e.name ASC';

    const settings = await getSettings();
    const rows = await query.all(sql, params);
    // Employees without a record get default Belum Absen status
    const result = rows.map(r => ({
      ...r,
      status: r.status || 'Belum Absen',
      shift: r.shift || '',
      check_in_time: r.check_in_time || '',
      notes: r.notes || '',
    }));
    res.json({
      success: true,
      data: result,
      cutoffs: {
        pagi: settings.shift_pagi_cutoff || '06:30',
        siang: settings.shift_siang_cutoff || '14:30',
      },
    });
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
    const employeeId = parseInt(req.params.employeeId, 10);
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Format date harus YYYY-MM-DD.' });
    }

    const emp = await query.get('SELECT id FROM employees WHERE id = ? AND status = ?', [employeeId, 'Active']);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan atau tidak aktif.' });

    const { shift = '', check_in_time = '', status: bodyStatus = 'Tidak Hadir', notes = '' } = req.body;
    let cleanTime = '';
    if (check_in_time && String(check_in_time).trim() !== '') {
      const normalized = normalizeTimeHHMM(check_in_time);
      if (!normalized) {
        return res.status(400).json({ success: false, message: 'Format jam masuk harus HH:MM (contoh 06:30).' });
      }
      cleanTime = normalized;
    }

    const settings = await getSettings();

    let status, is_late;
    if (cleanTime) {
      const computed = computeStatus(shift, cleanTime, settings);
      status = computed.status;
      is_late = computed.is_late;
    } else {
      // Manual status: Tidak Hadir, Izin, Sakit, Cuti
      const allowed = ['Tidak Hadir', 'Izin', 'Sakit', 'Cuti'];
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
        [shift, cleanTime || null, status, is_late, notes || null, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO daily_attendance (employee_id, date, shift, check_in_time, status, is_late, notes) VALUES (?,?,?,?,?,?,?)`,
        [employeeId, date, shift, cleanTime || null, status, is_late, notes || null]
      );
    }

    // Auto-sync to attendance_records for the payroll period that this date falls into
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const period = getPeriodForDate(date, startDay, endDay);
    const rules = await getPenaltyRules();
    await syncEmployeePeriod(employeeId, period, settings, rules);

    const saved = await query.get(
      'SELECT * FROM daily_attendance WHERE employee_id = ? AND date = ?',
      [employeeId, date]
    );
    // Preserve employee_id in `id` and expose daily_attendance PK as `record_id` matching getByDate shape
    res.json({
      success: true,
      data: {
        ...saved,
        record_id: saved.id,
        id: employeeId,
        shift: saved.shift || '',
        check_in_time: saved.check_in_time || '',
        notes: saved.notes || '',
      },
      message: 'Absensi disimpan.'
    });
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
    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);

    let sql = `
      SELECT e.id, e.name, e.position, e.employee_type, e.branch_id, b.name AS branch_name,
             COUNT(d.id) AS total_recorded,
             COUNT(CASE WHEN d.status = 'Hadir' THEN 1 END) AS days_hadir,
             COUNT(CASE WHEN d.status = 'Telat' THEN 1 END) AS days_telat,
             COUNT(CASE WHEN d.status = 'Tidak Hadir' THEN 1 END) AS days_tidak_hadir,
             COUNT(CASE WHEN d.status = 'Izin' THEN 1 END) AS days_izin,
             COUNT(CASE WHEN d.status = 'Sakit' THEN 1 END) AS days_sakit,
             COUNT(CASE WHEN d.status = 'Cuti' THEN 1 END) AS days_cuti,
             COUNT(CASE WHEN d.is_late = 1 THEN 1 END) AS late_count,
             a.id AS record_id, a.days_absent, a.late_count AS rec_late_count,
             a.cash_advance, a.fake_money,
             a.deduction_absent, a.deduction_late, a.asben_contribution, a.notes AS rec_notes
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN daily_attendance d ON d.employee_id = e.id AND d.date BETWEEN ? AND ?
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.period = ?
      WHERE e.status = 'Active'
    `;
    const params = [startDate, endDate, period];
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(branch_id); }
    sql += ' GROUP BY e.id ORDER BY b.name ASC, e.name ASC';

    const rows = await query.all(sql, params);
    res.json({
      success: true,
      data: rows,
      period_range: { startDate, endDate, label: getPeriodLabel(period, startDay, endDay) }
    });
  } catch (err) {
    console.error('API Error (attendance getMonthlySummary):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/attendance/daily-detail/:employeeId?period=YYYY-MM
 * Day-by-day records for one employee in a given period.
 */
exports.getEmployeeDailyDetail = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId, 10);
    const { period } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'period wajib format YYYY-MM.' });
    }
    const settings = await getSettings();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);
    const rows = await query.all(
      'SELECT * FROM daily_attendance WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
      [employeeId, startDate, endDate]
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
    const employeeId = parseInt(req.params.employeeId, 10);
    const { period } = req.params;
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });
    }
    const emp = await query.get('SELECT id FROM employees WHERE id = ?', [employeeId]);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const cash_advance = Math.max(0, parseFloat(req.body.cash_advance) || 0);
    const fake_money = Math.max(0, parseFloat(req.body.fake_money) || 0);

    const existing = await query.get(
      'SELECT id, notes FROM attendance_records WHERE employee_id = ? AND period = ?',
      [employeeId, period]
    );
    const finalNotes = req.body.notes !== undefined
      ? String(req.body.notes ?? '')
      : (existing ? (existing.notes || '') : '');

    if (existing) {
      await query.run(
        `UPDATE attendance_records SET cash_advance=?, fake_money=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [cash_advance, fake_money, finalNotes, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO attendance_records (employee_id, period, cash_advance, fake_money, notes) VALUES (?,?,?,?,?)`,
        [employeeId, period, cash_advance, fake_money, finalNotes]
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
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const { startDate, endDate } = getPeriodDateRange(period, startDay, endDay);

    const employees = await query.all(
      `SELECT DISTINCT employee_id FROM daily_attendance WHERE date BETWEEN ? AND ?`,
      [startDate, endDate]
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
