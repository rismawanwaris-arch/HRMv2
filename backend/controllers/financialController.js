const { query } = require('../db');

/**
 * GET /api/financial/outlet?period=YYYY-MM
 * Returns all konter branches with financial data for the given period.
 * Gaji karyawan auto-computed from payroll_entries (sum THP per branch).
 * Sewa comes from branches.rent_amount.
 * Penjualan & operasional from outlet_financials (manual input).
 */
exports.getOutletReport = async (req, res) => {
  try {
    const { period } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Parameter period harus format YYYY-MM.' });
    }

    const branches = await query.all(
      "SELECT id, code, name, rent_amount FROM branches WHERE status = 'Active' AND location_type = 'Konter' ORDER BY name ASC"
    );

    const results = [];
    for (const branch of branches) {
      const fin = await query.get(
        'SELECT penjualan, operasional, notes FROM outlet_financials WHERE branch_id = ? AND period = ?',
        [branch.id, period]
      );

      const payrollRow = await query.get(
        `SELECT COALESCE(SUM(pe.take_home_pay), 0) AS total_gaji
         FROM payroll_entries pe
         WHERE pe.branch_id = ? AND pe.period = ?`,
        [branch.id, period]
      );

      const penjualan = fin ? (fin.penjualan || 0) : 0;
      const operasional = fin ? (fin.operasional || 0) : 0;
      const sewa = branch.rent_amount || 0;
      const gaji = payrollRow ? (payrollRow.total_gaji || 0) : 0;
      const total_beban = gaji + sewa + operasional;
      const laba_rugi = penjualan - total_beban;

      results.push({
        branch_id: branch.id,
        branch_code: branch.code,
        branch_name: branch.name,
        period,
        penjualan,
        gaji,
        sewa,
        operasional,
        total_beban,
        laba_rugi,
        notes: fin ? fin.notes : null,
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('API Error (getOutletReport):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/financial/outlet/:branchId/:period
 * Upsert penjualan + operasional for a branch-period.
 */
exports.upsertOutlet = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    const { period } = req.params;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });
    }

    const penjualan = parseFloat(req.body.penjualan) || 0;
    const operasional = parseFloat(req.body.operasional) || 0;
    const notes = req.body.notes !== undefined ? String(req.body.notes) : null;

    await query.run(
      `INSERT INTO outlet_financials (branch_id, period, penjualan, operasional, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(branch_id, period) DO UPDATE SET
         penjualan = excluded.penjualan,
         operasional = excluded.operasional,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
      [branchId, period, penjualan, operasional, notes]
    );

    res.json({ success: true, message: 'Data keuangan berhasil disimpan.' });
  } catch (err) {
    console.error('API Error (upsertOutlet):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
