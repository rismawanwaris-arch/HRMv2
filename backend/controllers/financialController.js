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

/**
 * GET /api/financial/warehouse?period=YYYY-MM
 * Returns all warehouse branches with financial report for the given period.
 */
exports.getWarehouseReport = async (req, res) => {
  try {
    const { period } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Parameter period harus format YYYY-MM.' });
    }

    const branches = await query.all(
      "SELECT id, code, name, has_petshop FROM branches WHERE status = 'Active' AND location_type = 'Gudang' ORDER BY name ASC"
    );

    const results = [];
    for (const branch of branches) {
      const fin = await query.get(
        'SELECT * FROM warehouse_reports WHERE branch_id = ? AND period = ?',
        [branch.id, period]
      );

      // ASBEN revenue: total late deductions from employees in this warehouse branch
      const asbenRow = await query.get(
        `SELECT COALESCE(SUM(ar.deduction_late), 0) AS total_asben
         FROM attendance_records ar
         JOIN employees e ON ar.employee_id = e.id
         WHERE e.branch_id = ? AND ar.period = ?`,
        [branch.id, period]
      );

      // Staff payroll expenses: total THP for employees in this warehouse branch
      const payrollRow = await query.get(
        `SELECT COALESCE(SUM(pe.take_home_pay), 0) AS total_gaji
         FROM payroll_entries pe
         WHERE pe.branch_id = ? AND pe.period = ?`,
        [branch.id, period]
      );

      const penj_gudang = fin ? (fin.penj_gudang || 0) : 0;
      const pendapatan_lain = fin ? (fin.pendapatan_lain || 0) : 0;
      const retur_penjualan = fin ? (fin.retur_penjualan || 0) : 0;
      const pend_konter_all = fin ? (fin.pend_konter_all || 0) : 0;
      const pendapatan_asben = asbenRow ? (asbenRow.total_asben || 0) : 0;

      const total_pendapatan = penj_gudang + pendapatan_lain - retur_penjualan + pend_konter_all + pendapatan_asben;

      const hpp_gudang = fin ? (fin.hpp_gudang || 0) : 0;
      const potongan_laba_petshop = fin ? (fin.potongan_laba_petshop || 0) : 0;
      const total_hpp = hpp_gudang + potongan_laba_petshop;

      const laba_kotor = total_pendapatan - total_hpp;

      const biaya_operasional = fin ? (fin.biaya_operasional || 0) : 0;
      const biaya_payroll = payrollRow ? (payrollRow.total_gaji || 0) : 0;
      const biaya_bonus_penjualan = fin ? (fin.biaya_bonus_penjualan || 0) : 0;
      const bagi_hasil_petshop = fin ? (fin.bagi_hasil_petshop || 0) : 0;
      const penyusutan = fin ? (fin.penyusutan || 0) : 0;

      // Formula 17%: (Laba Kotor - Potongan Laba Petshop - Biaya Operasional) * 17%
      const basis17 = laba_kotor - potongan_laba_petshop - biaya_operasional;
      const potongan_17pct = basis17 > 0 ? basis17 * 0.17 : 0;

      const total_biaya = biaya_operasional + potongan_17pct + biaya_payroll + biaya_bonus_penjualan + bagi_hasil_petshop + penyusutan;
      const laba_bersih = laba_kotor - total_biaya;

      results.push({
        branch_id: branch.id,
        branch_code: branch.code,
        branch_name: branch.name,
        has_petshop: !!branch.has_petshop,
        period,
        penj_gudang,
        pendapatan_lain,
        retur_penjualan,
        pend_konter_all,
        pendapatan_asben,
        total_pendapatan,
        hpp_gudang,
        potongan_laba_petshop,
        total_hpp,
        laba_kotor,
        biaya_operasional,
        potongan_17pct,
        biaya_payroll,
        biaya_bonus_penjualan,
        bagi_hasil_petshop,
        penyusutan,
        total_biaya,
        laba_bersih,
        notes: fin ? fin.notes : null,
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('API Error (getWarehouseReport):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/financial/warehouse/:branchId/:period
 * Upsert warehouse financial report components for a branch-period.
 */
exports.upsertWarehouse = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    const { period } = req.params;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Format period harus YYYY-MM.' });
    }

    const {
      penj_gudang = 0,
      pendapatan_lain = 0,
      retur_penjualan = 0,
      pend_konter_all = 0,
      hpp_gudang = 0,
      potongan_laba_petshop = 0,
      biaya_operasional = 0,
      biaya_bonus_penjualan = 0,
      bagi_hasil_petshop = 0,
      penyusutan = 0,
      notes = null
    } = req.body;

    await query.run(
      `INSERT INTO warehouse_reports (
        branch_id, period, penj_gudang, pendapatan_lain, retur_penjualan, pend_konter_all,
        hpp_gudang, potongan_laba_petshop, biaya_operasional, biaya_bonus_penjualan,
        bagi_hasil_petshop, penyusutan, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(branch_id, period) DO UPDATE SET
        penj_gudang = excluded.penj_gudang,
        pendapatan_lain = excluded.pendapatan_lain,
        retur_penjualan = excluded.retur_penjualan,
        pend_konter_all = excluded.pend_konter_all,
        hpp_gudang = excluded.hpp_gudang,
        potongan_laba_petshop = excluded.potongan_laba_petshop,
        biaya_operasional = excluded.biaya_operasional,
        biaya_bonus_penjualan = excluded.biaya_bonus_penjualan,
        bagi_hasil_petshop = excluded.bagi_hasil_petshop,
        penyusutan = excluded.penyusutan,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      [
        branchId, period,
        parseFloat(penj_gudang) || 0,
        parseFloat(pendapatan_lain) || 0,
        parseFloat(retur_penjualan) || 0,
        parseFloat(pend_konter_all) || 0,
        parseFloat(hpp_gudang) || 0,
        parseFloat(potongan_laba_petshop) || 0,
        parseFloat(biaya_operasional) || 0,
        parseFloat(biaya_bonus_penjualan) || 0,
        parseFloat(bagi_hasil_petshop) || 0,
        parseFloat(penyusutan) || 0,
        notes ? String(notes) : null
      ]
    );

    res.json({ success: true, message: 'Laporan keuangan gudang berhasil disimpan.' });
  } catch (err) {
    console.error('API Error (upsertWarehouse):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/financial/consolidation?period=YYYY-MM
 * Returns consolidated financial summary for all locations (Konter + Gudang).
 */
exports.getConsolidatedReport = async (req, res) => {
  try {
    const { period } = req.query;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Parameter period harus format YYYY-MM.' });
    }

    const branches = await query.all(
      "SELECT id, code, name, location_type, rent_amount, has_petshop FROM branches WHERE status = 'Active' ORDER BY location_type ASC, name ASC"
    );

    const items = [];

    for (const branch of branches) {
      if (branch.location_type === 'Gudang') {
        const fin = await query.get(
          'SELECT * FROM warehouse_reports WHERE branch_id = ? AND period = ?',
          [branch.id, period]
        );

        const asbenRow = await query.get(
          `SELECT COALESCE(SUM(ar.deduction_late), 0) AS total_asben
           FROM attendance_records ar
           JOIN employees e ON ar.employee_id = e.id
           WHERE e.branch_id = ? AND ar.period = ?`,
          [branch.id, period]
        );

        const payrollRow = await query.get(
          `SELECT COALESCE(SUM(pe.take_home_pay), 0) AS total_gaji
           FROM payroll_entries pe
           WHERE pe.branch_id = ? AND pe.period = ?`,
          [branch.id, period]
        );

        const penj_gudang = fin ? (fin.penj_gudang || 0) : 0;
        const pendapatan_lain = fin ? (fin.pendapatan_lain || 0) : 0;
        const retur_penjualan = fin ? (fin.retur_penjualan || 0) : 0;
        const pend_konter_all = fin ? (fin.pend_konter_all || 0) : 0;
        const pendapatan_asben = asbenRow ? (asbenRow.total_asben || 0) : 0;

        const total_pendapatan = penj_gudang + pendapatan_lain - retur_penjualan + pend_konter_all + pendapatan_asben;

        const hpp_gudang = fin ? (fin.hpp_gudang || 0) : 0;
        const potongan_laba_petshop = fin ? (fin.potongan_laba_petshop || 0) : 0;
        const total_hpp = hpp_gudang + potongan_laba_petshop;

        const laba_kotor = total_pendapatan - total_hpp;

        const biaya_operasional = fin ? (fin.biaya_operasional || 0) : 0;
        const biaya_payroll = payrollRow ? (payrollRow.total_gaji || 0) : 0;
        const biaya_bonus_penjualan = fin ? (fin.biaya_bonus_penjualan || 0) : 0;
        const bagi_hasil_petshop = fin ? (fin.bagi_hasil_petshop || 0) : 0;
        const penyusutan = fin ? (fin.penyusutan || 0) : 0;

        const basis17 = laba_kotor - potongan_laba_petshop - biaya_operasional;
        const potongan_17pct = basis17 > 0 ? basis17 * 0.17 : 0;

        const total_biaya = biaya_operasional + potongan_17pct + biaya_payroll + biaya_bonus_penjualan + bagi_hasil_petshop + penyusutan;
        const laba_bersih = laba_kotor - total_biaya;

        items.push({
          branch_id: branch.id,
          branch_code: branch.code,
          branch_name: branch.name,
          location_type: 'Gudang',
          total_pendapatan,
          total_hpp,
          laba_kotor,
          total_biaya,
          laba_bersih,
          gaji: biaya_payroll,
          operasional: biaya_operasional,
          sewa: 0,
        });
      } else {
        // Konter
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

        const asbenRow = await query.get(
          `SELECT COALESCE(SUM(ar.deduction_late), 0) AS total_asben
           FROM attendance_records ar
           JOIN employees e ON ar.employee_id = e.id
           WHERE e.branch_id = ? AND ar.period = ?`,
          [branch.id, period]
        );

        const penjualan = fin ? (fin.penjualan || 0) : 0;
        const pendapatan_asben = asbenRow ? (asbenRow.total_asben || 0) : 0;
        const total_pendapatan = penjualan + pendapatan_asben;
        const total_hpp = 0;
        const laba_kotor = total_pendapatan - total_hpp;

        const operasional = fin ? (fin.operasional || 0) : 0;
        const sewa = branch.rent_amount || 0;
        const gaji = payrollRow ? (payrollRow.total_gaji || 0) : 0;
        const total_biaya = gaji + sewa + operasional;
        const laba_bersih = laba_kotor - total_biaya;

        items.push({
          branch_id: branch.id,
          branch_code: branch.code,
          branch_name: branch.name,
          location_type: 'Konter',
          total_pendapatan,
          total_hpp,
          laba_kotor,
          total_biaya,
          laba_bersih,
          gaji,
          operasional,
          sewa,
        });
      }
    }

    const grand_total = items.reduce(
      (acc, it) => ({
        total_pendapatan: acc.total_pendapatan + it.total_pendapatan,
        total_hpp: acc.total_hpp + it.total_hpp,
        laba_kotor: acc.laba_kotor + it.laba_kotor,
        total_biaya: acc.total_biaya + it.total_biaya,
        laba_bersih: acc.laba_bersih + it.laba_bersih,
      }),
      { total_pendapatan: 0, total_hpp: 0, laba_kotor: 0, total_biaya: 0, laba_bersih: 0 }
    );

    res.json({
      success: true,
      period,
      data: items,
      grand_total,
    });
  } catch (err) {
    console.error('API Error (getConsolidatedReport):', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
