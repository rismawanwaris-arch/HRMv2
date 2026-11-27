const { query } = require('../db');
const { getPeriodForDate } = require('../utils/payrollCalc');
const { getSettings, getPenaltyRules, syncEmployeePeriod } = require('../utils/attendanceSync');

function isValidDateStr(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const [y, m, d] = String(s).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function enumerateDatesUTC(startDate, endDate) {
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
    return { error: 'Format tanggal wajib YYYY-MM-DD dan valid.' };
  }
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (start > end) {
    return { error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.' };
  }
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (diffDays > 60) {
    return { error: 'Rentang cuti maksimal 60 hari per pengajuan.' };
  }
  const dates = [];
  for (let i = 0; i < diffDays; i++) {
    const dt = new Date(start.getTime() + i * 86400000);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return { dates };
}

async function ensureBalanceRow(employeeId, leaveType, year, settings) {
  const existing = await query.get(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
    [employeeId, leaveType.id, year]
  );
  if (existing) return existing;

  const annualQuota = parseFloat(settings.annual_leave_quota);
  const defaultQuota = leaveType.code === 'ANNUAL' && Number.isFinite(annualQuota)
    ? annualQuota
    : (Number(leaveType.default_quota) || 0);

  await query.run(
    'INSERT OR IGNORE INTO leave_balances (employee_id, leave_type_id, year, quota, used, carry_over) VALUES (?, ?, ?, ?, 0, 0)',
    [employeeId, leaveType.id, year, defaultQuota]
  );
  return query.get(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
    [employeeId, leaveType.id, year]
  );
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

exports.getTypes = async (req, res) => {
  try {
    const includeInactive = req.query.all === '1';
    const sql = includeInactive
      ? 'SELECT * FROM leave_types ORDER BY id ASC'
      : 'SELECT * FROM leave_types WHERE is_active = 1 ORDER BY id ASC';
    const rows = await query.all(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (getTypes):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createType = async (req, res) => {
  try {
    const {
      code,
      name,
      default_quota = 0,
      is_paid = 1,
      attendance_status = 'Cuti',
      requires_attachment = 0,
    } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan nama jenis cuti wajib diisi.' });
    }
    const allowedStatuses = ['Cuti', 'Izin', 'Sakit', 'Tidak Hadir'];
    if (!allowedStatuses.includes(attendance_status)) {
      return res.status(400).json({ success: false, message: 'Status absensi harus Cuti, Izin, Sakit, atau Tidak Hadir.' });
    }
    const cleanCode = String(code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!cleanCode) return res.status(400).json({ success: false, message: 'Kode jenis cuti tidak valid.' });

    const resIns = await query.run(
      'INSERT INTO leave_types (code, name, default_quota, is_paid, attendance_status, requires_attachment, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [cleanCode, String(name).trim(), Math.max(0, parseInt(default_quota, 10) || 0), is_paid ? 1 : 0, attendance_status, requires_attachment ? 1 : 0]
    );
    const created = await query.get('SELECT * FROM leave_types WHERE id = ?', [resIns.id]);
    res.json({ success: true, data: created, message: 'Jenis cuti berhasil ditambahkan.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Kode jenis cuti sudah digunakan.' });
    }
    console.error('API Error (createType):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM leave_types WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Jenis cuti tidak ditemukan.' });

    const { name, default_quota, is_paid, attendance_status, requires_attachment, is_active } = req.body;
    const nextStatus = attendance_status || existing.attendance_status;
    if (!['Cuti', 'Izin', 'Sakit', 'Tidak Hadir'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Status absensi harus Cuti, Izin, Sakit, atau Tidak Hadir.' });
    }
    await query.run(
      'UPDATE leave_types SET name=?, default_quota=?, is_paid=?, attendance_status=?, requires_attachment=?, is_active=? WHERE id=?',
      [
        name !== undefined ? String(name).trim() : existing.name,
        default_quota !== undefined ? Math.max(0, parseInt(default_quota, 10) || 0) : existing.default_quota,
        is_paid !== undefined ? (is_paid ? 1 : 0) : existing.is_paid,
        nextStatus,
        requires_attachment !== undefined ? (requires_attachment ? 1 : 0) : existing.requires_attachment,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        id,
      ]
    );
    const updated = await query.get('SELECT * FROM leave_types WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: 'Jenis cuti berhasil diperbarui.' });
  } catch (err) {
    console.error('API Error (updateType):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Leave Balances ───────────────────────────────────────────────────────────

exports.getBalances = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { branch_id, employee_id } = req.query;
    const settings = await getSettings();

    const annualType = await query.get("SELECT * FROM leave_types WHERE code = 'ANNUAL' AND is_active = 1")
      || await query.get('SELECT * FROM leave_types WHERE default_quota > 0 AND is_active = 1 ORDER BY id ASC LIMIT 1');

    if (annualType) {
      let empSql = "SELECT id FROM employees WHERE status = 'Active'";
      const empParams = [];
      if (branch_id) { empSql += ' AND branch_id = ?'; empParams.push(parseInt(branch_id, 10)); }
      if (employee_id) { empSql += ' AND id = ?'; empParams.push(parseInt(employee_id, 10)); }
      const activeEmps = await query.all(empSql, empParams);
      for (const emp of activeEmps) {
        await ensureBalanceRow(emp.id, annualType, year, settings);
      }
    }

    let sql = `
      SELECT lb.*, (lb.quota + lb.carry_over - lb.used) AS remaining,
             e.name AS employee_name, e.position, e.employee_type, e.branch_id,
             b.name AS branch_name, lt.code AS leave_code, lt.name AS leave_type_name
      FROM leave_balances lb
      JOIN employees e ON lb.employee_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.year = ? AND e.status = 'Active'
    `;
    const params = [year];
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(parseInt(branch_id, 10)); }
    if (employee_id) { sql += ' AND lb.employee_id = ?'; params.push(parseInt(employee_id, 10)); }
    sql += ' ORDER BY e.name ASC, lt.id ASC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows, year });
  } catch (err) {
    console.error('API Error (getBalances):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.initYearBalances = async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();
    const carryOverMax = Math.max(0, parseFloat(req.body.carry_over_max) || 0);
    const settings = await getSettings();
    const annualQuotaSetting = parseFloat(settings.annual_leave_quota);

    const quotaTypes = await query.all('SELECT * FROM leave_types WHERE is_active = 1 AND default_quota > 0');
    const employees = await query.all("SELECT id FROM employees WHERE status = 'Active'");

    let created = 0;
    await query.run('BEGIN TRANSACTION');
    try {
      for (const emp of employees) {
        for (const lt of quotaTypes) {
          const exists = await query.get(
            'SELECT id FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
            [emp.id, lt.id, year]
          );
          if (exists) continue;

          let carryOver = 0;
          if (carryOverMax > 0) {
            const prev = await query.get(
              'SELECT quota, used, carry_over FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
              [emp.id, lt.id, year - 1]
            );
            if (prev) {
              const prevRem = Math.max(0, (prev.quota + prev.carry_over) - prev.used);
              carryOver = Math.min(prevRem, carryOverMax);
            }
          }
          const quota = lt.code === 'ANNUAL' && Number.isFinite(annualQuotaSetting)
            ? annualQuotaSetting
            : lt.default_quota;

          await query.run(
            'INSERT INTO leave_balances (employee_id, leave_type_id, year, quota, used, carry_over) VALUES (?, ?, ?, ?, 0, ?)',
            [emp.id, lt.id, year, quota, carryOver]
          );
          created++;
        }
      }
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    res.json({ success: true, created, year, message: `Inisialisasi saldo cuti ${year} selesai (${created} entri baru).` });
  } catch (err) {
    console.error('API Error (initYearBalances):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateBalance = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM leave_balances WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Saldo cuti tidak ditemukan.' });

    const quota = req.body.quota !== undefined ? Math.max(0, parseFloat(req.body.quota) || 0) : existing.quota;
    const carryOver = req.body.carry_over !== undefined ? Math.max(0, parseFloat(req.body.carry_over) || 0) : existing.carry_over;

    await query.run(
      'UPDATE leave_balances SET quota = ?, carry_over = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [quota, carryOver, id]
    );
    const updated = await query.get(
      'SELECT *, (quota + carry_over - used) AS remaining FROM leave_balances WHERE id = ?',
      [id]
    );
    res.json({ success: true, data: updated, message: 'Saldo cuti berhasil diperbarui.' });
  } catch (err) {
    console.error('API Error (updateBalance):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Leave Requests ───────────────────────────────────────────────────────────

exports.getRequests = async (req, res) => {
  try {
    const { status, employee_id, branch_id, year } = req.query;
    let sql = `
      SELECT lr.*, e.name AS employee_name, e.position, e.branch_id,
             b.name AS branch_name, lt.code AS leave_code, lt.name AS leave_type_name,
             lt.is_paid, lt.attendance_status
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND lr.status = ?'; params.push(status); }
    if (employee_id) { sql += ' AND lr.employee_id = ?'; params.push(parseInt(employee_id, 10)); }
    if (branch_id) { sql += ' AND e.branch_id = ?'; params.push(parseInt(branch_id, 10)); }
    if (year) { sql += " AND substr(lr.start_date, 1, 4) = ?"; params.push(String(year)); }
    sql += ' ORDER BY lr.created_at DESC, lr.id DESC';

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('API Error (getRequests):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createRequest = async (req, res) => {
  try {
    const employeeId = parseInt(req.body.employee_id, 10);
    const leaveTypeId = parseInt(req.body.leave_type_id, 10);
    const { start_date, end_date, reason = '' } = req.body;

    const emp = await query.get("SELECT id, name FROM employees WHERE id = ? AND status = 'Active'", [employeeId]);
    if (!emp) return res.status(404).json({ success: false, message: 'Karyawan aktif tidak ditemukan.' });

    const lt = await query.get('SELECT * FROM leave_types WHERE id = ? AND is_active = 1', [leaveTypeId]);
    if (!lt) return res.status(404).json({ success: false, message: 'Jenis cuti aktif tidak ditemukan.' });

    const { dates, error: dateErr } = enumerateDatesUTC(start_date, end_date);
    if (dateErr) return res.status(400).json({ success: false, message: dateErr });
    const totalDays = dates.length;

    const overlap = await query.get(
      `SELECT id FROM leave_requests
       WHERE employee_id = ? AND status IN ('Pending', 'Approved')
         AND start_date <= ? AND end_date >= ?`,
      [employeeId, end_date, start_date]
    );
    if (overlap) {
      return res.status(400).json({ success: false, message: 'Karyawan sudah memiliki pengajuan cuti yang bertumpukan pada tanggal tersebut.' });
    }

    const settings = await getSettings();
    if (lt.default_quota > 0) {
      const year = parseInt(start_date.slice(0, 4), 10);
      const bal = await ensureBalanceRow(employeeId, lt, year, settings);
      const remaining = (bal.quota + bal.carry_over) - bal.used;
      if (remaining < totalDays) {
        return res.status(400).json({
          success: false,
          message: `Saldo ${lt.name} tidak mencukupi (tersisa ${remaining} hari, diajukan ${totalDays} hari).`,
        });
      }
    }

    const actor = req.user?.username || 'system';
    const result = await query.run(
      `INSERT INTO leave_requests
       (employee_id, leave_type_id, start_date, end_date, total_days, reason, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
      [employeeId, leaveTypeId, start_date, end_date, totalDays, String(reason || '').trim() || null, actor]
    );

    const created = await query.get(
      `SELECT lr.*, e.name AS employee_name, lt.name AS leave_type_name
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.id = ?`,
      [result.id]
    );
    res.status(201).json({ success: true, data: created, message: 'Pengajuan cuti berhasil dikirim.' });
  } catch (err) {
    console.error('API Error (createRequest):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reqRow = await query.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!reqRow) return res.status(404).json({ success: false, message: 'Pengajuan cuti tidak ditemukan.' });
    if (reqRow.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Pengajuan sudah berstatus ${reqRow.status}.` });
    }

    const lt = await query.get('SELECT * FROM leave_types WHERE id = ?', [reqRow.leave_type_id]);
    if (!lt) return res.status(404).json({ success: false, message: 'Jenis cuti tidak ditemukan.' });

    const { dates, error: dateErr } = enumerateDatesUTC(reqRow.start_date, reqRow.end_date);
    if (dateErr) return res.status(400).json({ success: false, message: dateErr });

    const settings = await getSettings();
    const rules = await getPenaltyRules();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;
    const actor = req.user?.username || 'system';
    const approvalNotes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    const year = parseInt(reqRow.start_date.slice(0, 4), 10);

    if (lt.default_quota > 0) {
      const bal = await ensureBalanceRow(reqRow.employee_id, lt, year, settings);
      const remaining = (bal.quota + bal.carry_over) - bal.used;
      if (remaining < reqRow.total_days) {
        return res.status(400).json({
          success: false,
          message: `Saldo ${lt.name} tidak mencukupi untuk disetujui (sisa ${remaining} hari).`,
        });
      }
    }

    const noteText = `[Cuti] ${lt.name}${reqRow.reason ? `: ${reqRow.reason}` : ''}`;
    const affectedPeriods = new Set();

    await query.run('BEGIN TRANSACTION');
    try {
      const upd = await query.run(
        "UPDATE leave_requests SET status = 'Approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Pending'",
        [actor, approvalNotes, id]
      );
      if (!upd.changes) {
        await query.run('ROLLBACK').catch(() => {});
        return res.status(400).json({ success: false, message: 'Pengajuan cuti sudah diproses sebelumnya.' });
      }

      if (lt.default_quota > 0) {
        await query.run(
          'UPDATE leave_balances SET used = used + ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
          [reqRow.total_days, reqRow.employee_id, lt.id, year]
        );
      }

      for (const dateStr of dates) {
        await query.run(
          `INSERT INTO daily_attendance (employee_id, date, shift, check_in_time, status, is_late, notes)
           VALUES (?, ?, '', NULL, ?, 0, ?)
           ON CONFLICT(employee_id, date) DO UPDATE SET
             shift = '', check_in_time = NULL, status = excluded.status, is_late = 0,
             notes = excluded.notes, updated_at = CURRENT_TIMESTAMP`,
          [reqRow.employee_id, dateStr, lt.attendance_status, noteText]
        );
        affectedPeriods.add(getPeriodForDate(dateStr, startDay, endDay));
      }

      for (const period of affectedPeriods) {
        await syncEmployeePeriod(reqRow.employee_id, period, settings, rules);
      }

      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    const updated = await query.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    res.json({
      success: true,
      data: updated,
      synced_days: dates.length,
      message: `Cuti disetujui dan disinkronkan ke absensi (${dates.length} hari).`,
    });
  } catch (err) {
    console.error('API Error (approveRequest):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reqRow = await query.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!reqRow) return res.status(404).json({ success: false, message: 'Pengajuan cuti tidak ditemukan.' });
    if (reqRow.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Pengajuan sudah berstatus ${reqRow.status}.` });
    }

    const actor = req.user?.username || 'system';
    const notes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    const upd = await query.run(
      "UPDATE leave_requests SET status = 'Rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Pending'",
      [actor, notes, id]
    );
    if (!upd.changes) {
      return res.status(400).json({ success: false, message: 'Pengajuan cuti sudah diproses sebelumnya.' });
    }
    const updated = await query.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: 'Pengajuan cuti ditolak.' });
  } catch (err) {
    console.error('API Error (rejectRequest):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reqRow = await query.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!reqRow) return res.status(404).json({ success: false, message: 'Pengajuan cuti tidak ditemukan.' });
    if (!['Pending', 'Approved'].includes(reqRow.status)) {
      return res.status(400).json({ success: false, message: `Pengajuan berstatus ${reqRow.status} tidak dapat dibatalkan.` });
    }
    const isApprover = ['finance', 'master'].includes(req.user?.role);
    if (reqRow.status === 'Approved' && !isApprover) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN_ROLE', message: 'Hanya Finance atau Master yang dapat membatalkan cuti yang sudah disetujui.' });
    }
    if (!isApprover && reqRow.requested_by !== req.user?.username) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN_OWNER', message: 'Akses ditolak. Anda hanya dapat membatalkan pengajuan cuti yang Anda buat sendiri.' });
    }

    const actorNotes = req.body.approval_notes ? String(req.body.approval_notes).trim() : null;
    const settings = await getSettings();
    const rules = await getPenaltyRules();
    const startDay = parseInt(settings.payroll_period_start_day, 10) || 29;
    const endDay = parseInt(settings.payroll_period_end_day, 10) || 28;

    await query.run('BEGIN TRANSACTION');
    try {
      if (reqRow.status === 'Approved') {
        const lt = await query.get('SELECT * FROM leave_types WHERE id = ?', [reqRow.leave_type_id]);
        const year = parseInt(reqRow.start_date.slice(0, 4), 10);
        if (lt && lt.default_quota > 0) {
          await query.run(
            'UPDATE leave_balances SET used = MAX(0, used - ?), updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
            [reqRow.total_days, reqRow.employee_id, lt.id, year]
          );
        }

        if (lt) {
          await query.run(
            `DELETE FROM daily_attendance
             WHERE employee_id = ? AND date BETWEEN ? AND ?
               AND status = ? AND notes LIKE '[Cuti] %'`,
            [reqRow.employee_id, reqRow.start_date, reqRow.end_date, lt.attendance_status]
          );
        }

        const { dates } = enumerateDatesUTC(reqRow.start_date, reqRow.end_date);
        const affectedPeriods = new Set((dates || []).map((d) => getPeriodForDate(d, startDay, endDay)));
        for (const period of affectedPeriods) {
          await syncEmployeePeriod(reqRow.employee_id, period, settings, rules);
        }
      }

      await query.run(
        "UPDATE leave_requests SET status = 'Cancelled', approval_notes = COALESCE(?, approval_notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [actorNotes, id]
      );
      await query.run('COMMIT');
    } catch (txErr) {
      await query.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    res.json({ success: true, message: 'Pengajuan cuti berhasil dibatalkan.' });
  } catch (err) {
    console.error('API Error (cancelRequest):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
