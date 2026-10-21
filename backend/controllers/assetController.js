const { query } = require('../db');
const { generateAccessCode } = require('../utils/helpers');

// Helper to format date YYYY-MM-DD
function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 1. GET /api/assets
 * List all assets with optional search & filters
 */
exports.getAssets = async (req, res) => {
  try {
    const { branch_id, category, status, condition, search } = req.query;
    let sql = `
      SELECT a.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
      FROM outlet_assets a
      JOIN branches b ON a.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND a.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (category) {
      sql += ' AND a.category = ?';
      params.push(category);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (condition) {
      sql += ' AND a.condition = ?';
      params.push(condition);
    }
    if (search && search.trim() !== '') {
      sql += ' AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.serial_number LIKE ? OR a.brand LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY a.id DESC';

    const rows = await query.all(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : []
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('API Error (getAssets):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat data aset.' });
  }
};

/**
 * 2. GET /api/assets/stats
 * Overview KPI metrics for assets
 */
exports.getAssetStats = async (req, res) => {
  try {
    const totalActive = await query.get("SELECT COUNT(*) as count, COALESCE(SUM(purchase_cost), 0) as total_value FROM outlet_assets WHERE status = 'Aktif'");
    const totalReplaced = await query.get("SELECT COUNT(*) as count FROM outlet_assets WHERE status = 'Diganti'");
    const needAttention = await query.get("SELECT COUNT(*) as count FROM outlet_assets WHERE status = 'Aktif' AND condition IN ('Rusak Ringan', 'Rusak Berat', 'Dalam Perbaikan')");
    
    // Category counts
    const categoryStats = await query.all(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(purchase_cost), 0) as value
      FROM outlet_assets
      WHERE status = 'Aktif'
      GROUP BY category
    `);

    // Condition counts
    const conditionStats = await query.all(`
      SELECT condition, COUNT(*) as count
      FROM outlet_assets
      WHERE status = 'Aktif'
      GROUP BY condition
    `);

    // Recent 5 logs
    const recentLogs = await query.all(`
      SELECT l.*, a.name as asset_name, a.asset_code, fb.name as from_branch_name, tb.name as to_branch_name
      FROM outlet_asset_logs l
      JOIN outlet_assets a ON l.asset_id = a.id
      LEFT JOIN branches fb ON l.from_branch_id = fb.id
      LEFT JOIN branches tb ON l.to_branch_id = tb.id
      ORDER BY l.id DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        totalActive: totalActive ? totalActive.count : 0,
        totalValue: totalActive ? totalActive.total_value : 0,
        totalReplaced: totalReplaced ? totalReplaced.count : 0,
        needAttention: needAttention ? needAttention.count : 0,
        categories: categoryStats,
        conditions: conditionStats,
        recentLogs
      }
    });
  } catch (error) {
    console.error('API Error (getAssetStats):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat statistik aset.' });
  }
};

/**
 * 3. GET /api/assets/:id
 * Single asset detail with audit/replacement/mutation history
 */
exports.getAssetDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const asset = await query.get(
      `SELECT a.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
       FROM outlet_assets a
       JOIN branches b ON a.branch_id = b.id
       WHERE a.id = ?`,
      [id]
    );

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
    }

    const logs = await query.all(
      `SELECT l.*, fb.name as from_branch_name, tb.name as to_branch_name
       FROM outlet_asset_logs l
       LEFT JOIN branches fb ON l.from_branch_id = fb.id
       LEFT JOIN branches tb ON l.to_branch_id = tb.id
       WHERE l.asset_id = ?
       ORDER BY l.id DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...asset,
        photos: asset.photos ? JSON.parse(asset.photos) : [],
        logs: logs.map(l => ({
          ...l,
          photos: l.photos ? JSON.parse(l.photos) : []
        }))
      }
    });
  } catch (error) {
    console.error('API Error (getAssetDetail):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat detail aset.' });
  }
};

/**
 * 4. POST /api/assets
 * Add new asset (Penambahan Aset)
 */
exports.createAsset = async (req, res) => {
  try {
    const {
      name,
      category,
      branch_id,
      asset_code,
      purchase_date,
      purchase_cost,
      condition,
      status,
      brand,
      serial_number,
      vendor_supplier,
      notes
    } = req.body;

    if (!name || !category || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'Nama aset, kategori, dan cabang outlet wajib diisi.'
      });
    }

    // Generate asset_code if not supplied
    let finalCode = asset_code?.trim();
    if (!finalCode) {
      const branch = await query.get('SELECT code FROM branches WHERE id = ?', [branch_id]);
      const branchCode = branch?.code ? branch.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : 'OUT';
      const rand = generateAccessCode().slice(0, 4);
      finalCode = `AST-${branchCode}-${rand}`;
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const date = purchase_date || getTodayDateStr();

    const insertSql = `
      INSERT INTO outlet_assets (
        asset_code, name, category, branch_id, purchase_date, purchase_cost,
        condition, status, brand, serial_number, vendor_supplier, photos, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query.run(insertSql, [
      finalCode,
      name.trim(),
      category,
      parseInt(branch_id, 10),
      date,
      parseFloat(purchase_cost) || 0,
      condition || 'Baik',
      status || 'Aktif',
      brand || null,
      serial_number || null,
      vendor_supplier || null,
      JSON.stringify(photosList),
      notes || null
    ]);

    const assetId = result.id;

    // Log the addition
    await query.run(`
      INSERT INTO outlet_asset_logs (
        asset_id, log_type, log_date, to_branch_id, cost, reason, performed_by, notes
      ) VALUES (?, 'Penambahan', ?, ?, ?, 'Pendaftaran Aset Baru', ?, ?)
    `, [
      assetId,
      date,
      parseInt(branch_id, 10),
      parseFloat(purchase_cost) || 0,
      req.user?.username || 'Wisnu (GA)',
      notes || 'Aset baru berhasil didaftarkan ke sistem.'
    ]);

    res.status(201).json({
      success: true,
      message: `Aset ${name} berhasil ditambahkan dengan kode ${finalCode}.`,
      id: assetId,
      asset_code: finalCode
    });
  } catch (error) {
    console.error('API Error (createAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal menambahkan aset baru.' });
  }
};

/**
 * 5. PUT /api/assets/:id
 * Update general asset information
 */
exports.updateAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_assets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
    }

    const {
      name,
      category,
      branch_id,
      asset_code,
      purchase_date,
      purchase_cost,
      condition,
      status,
      brand,
      serial_number,
      vendor_supplier,
      notes
    } = req.body;

    let currentPhotos = existing.photos ? JSON.parse(existing.photos) : [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newFiles = req.files.map(f => f.filename);
      currentPhotos = [...currentPhotos, ...newFiles];
    }

    const updateSql = `
      UPDATE outlet_assets
      SET name = ?, category = ?, branch_id = ?, asset_code = ?, purchase_date = ?,
          purchase_cost = ?, condition = ?, status = ?, brand = ?, serial_number = ?,
          vendor_supplier = ?, photos = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await query.run(updateSql, [
      name ?? existing.name,
      category ?? existing.category,
      branch_id !== undefined ? parseInt(branch_id, 10) : existing.branch_id,
      asset_code ?? existing.asset_code,
      purchase_date ?? existing.purchase_date,
      purchase_cost !== undefined ? parseFloat(purchase_cost) : existing.purchase_cost,
      condition ?? existing.condition,
      status ?? existing.status,
      brand ?? existing.brand,
      serial_number ?? existing.serial_number,
      vendor_supplier ?? existing.vendor_supplier,
      JSON.stringify(currentPhotos),
      notes ?? existing.notes,
      id
    ]);

    res.json({ success: true, message: 'Data aset berhasil diperbarui.' });
  } catch (error) {
    console.error('API Error (updateAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data aset.' });
  }
};

/**
 * 6. POST /api/assets/:id/replace
 * Penggantian Aset (Asset Replacement Workflow)
 * Marks old asset as 'Diganti', logs reason & replacement details,
 * and optionally auto-creates the new replacement asset in the branch.
 */
exports.replaceAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_assets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
    }

    const {
      replacement_asset_name,
      replacement_brand,
      replacement_serial_number,
      replacement_cost,
      replacement_vendor,
      reason,
      performed_by,
      log_date,
      register_as_new_asset = true,
      notes
    } = req.body;

    if (!replacement_asset_name || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Nama aset pengganti dan alasan penggantian wajib diisi.'
      });
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const date = log_date || getTodayDateStr();
    const cost = parseFloat(replacement_cost) || 0;
    const actor = performed_by?.trim() || req.user?.username || 'Wisnu (GA)';

    // 1. Mark existing asset as 'Diganti'
    await query.run(`
      UPDATE outlet_assets
      SET status = 'Diganti', condition = 'Rusak Berat', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    // 2. Record the Replacement log
    await query.run(`
      INSERT INTO outlet_asset_logs (
        asset_id, log_type, log_date, from_branch_id, to_branch_id, cost,
        replacement_asset_name, reason, performed_by, photos, notes
      ) VALUES (?, 'Penggantian', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      date,
      existing.branch_id,
      existing.branch_id,
      cost,
      replacement_asset_name,
      reason,
      actor,
      JSON.stringify(photosList),
      notes || `Aset lama digantikan dengan ${replacement_asset_name}.`
    ]);

    let newAssetId = null;
    let newAssetCode = null;

    // 3. Automatically register the new replacement asset if desired
    if (register_as_new_asset === true || register_as_new_asset === 'true') {
      const branch = await query.get('SELECT code FROM branches WHERE id = ?', [existing.branch_id]);
      const branchCode = branch?.code ? branch.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : 'OUT';
      const rand = generateAccessCode().slice(0, 4);
      newAssetCode = `AST-${branchCode}-${rand}`;

      const newAssetResult = await query.run(`
        INSERT INTO outlet_assets (
          asset_code, name, category, branch_id, purchase_date, purchase_cost,
          condition, status, brand, serial_number, vendor_supplier, photos, notes
        ) VALUES (?, ?, ?, ?, ?, ?, 'Baik', 'Aktif', ?, ?, ?, ?, ?)
      `, [
        newAssetCode,
        replacement_asset_name.trim(),
        existing.category,
        existing.branch_id,
        date,
        cost,
        replacement_brand || null,
        replacement_serial_number || null,
        replacement_vendor || null,
        JSON.stringify(photosList),
        `Barang baru pengganti dari aset lama: ${existing.name} (${existing.asset_code}). Alasan: ${reason}`
      ]);

      newAssetId = newAssetResult.id;

      // Log the addition of the new asset
      await query.run(`
        INSERT INTO outlet_asset_logs (
          asset_id, log_type, log_date, to_branch_id, cost, reason, performed_by, notes
        ) VALUES (?, 'Penambahan', ?, ?, ?, 'Penggantian Aset Lama', ?, ?)
      `, [
        newAssetId,
        date,
        existing.branch_id,
        cost,
        actor,
        `Aset baru pengganti dari ${existing.name} (${existing.asset_code}).`
      ]);
    }

    res.json({
      success: true,
      message: `Aset lama ${existing.name} berhasil ditandai 'Diganti', dan ${replacement_asset_name} telah dicatat.`,
      new_asset_id: newAssetId,
      new_asset_code: newAssetCode
    });
  } catch (error) {
    console.error('API Error (replaceAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal melakukan proses penggantian aset.' });
  }
};

/**
 * 7. POST /api/assets/:id/mutate
 * Mutasi Aset Antar Cabang
 */
exports.mutateAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_assets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
    }

    const { to_branch_id, reason, log_date, performed_by, notes } = req.body;

    if (!to_branch_id) {
      return res.status(400).json({ success: false, message: 'Cabang tujuan mutasi wajib dipilih.' });
    }

    const targetBranchId = parseInt(to_branch_id, 10);
    if (targetBranchId === existing.branch_id) {
      return res.status(400).json({ success: false, message: 'Cabang tujuan tidak boleh sama dengan cabang asal.' });
    }

    const date = log_date || getTodayDateStr();
    const actor = performed_by?.trim() || req.user?.username || 'Wisnu (GA)';

    // Update asset branch
    await query.run(`
      UPDATE outlet_assets
      SET branch_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [targetBranchId, id]);

    // Record mutation log
    await query.run(`
      INSERT INTO outlet_asset_logs (
        asset_id, log_type, log_date, from_branch_id, to_branch_id, reason, performed_by, notes
      ) VALUES (?, 'Mutasi Cabang', ?, ?, ?, ?, ?, ?)
    `, [
      id,
      date,
      existing.branch_id,
      targetBranchId,
      reason || 'Kebutuhan operasional cabang',
      actor,
      notes || `Aset dipindahkan ke cabang baru.`
    ]);

    res.json({ success: true, message: 'Mutasi cabang aset berhasil disimpan.' });
  } catch (error) {
    console.error('API Error (mutateAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal melakukan mutasi aset.' });
  }
};

/**
 * 8. POST /api/assets/:id/service
 * Servis / Perbaikan Aset
 */
exports.serviceAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_assets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
    }

    const {
      log_date,
      cost,
      reason,
      performed_by,
      new_condition = 'Baik',
      notes
    } = req.body;

    const date = log_date || getTodayDateStr();
    const repairCost = parseFloat(cost) || 0;
    const actor = performed_by?.trim() || req.user?.username || 'Wisnu (GA)';

    // Update condition
    await query.run(`
      UPDATE outlet_assets
      SET condition = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [new_condition, id]);

    // Record service log
    await query.run(`
      INSERT INTO outlet_asset_logs (
        asset_id, log_type, log_date, to_branch_id, cost, reason, performed_by, notes
      ) VALUES (?, 'Perbaikan/Servis', ?, ?, ?, ?, ?, ?)
    `, [
      id,
      date,
      existing.branch_id,
      repairCost,
      reason || 'Servis dan perawatan rutin',
      actor,
      notes || `Kondisi aset setelah perbaikan: ${new_condition}.`
    ]);

    res.json({ success: true, message: 'Catatan servis aset berhasil disimpan.' });
  } catch (error) {
    console.error('API Error (serviceAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan catatan servis aset.' });
  }
};

/**
 * 9. DELETE /api/assets/:id
 */
exports.deleteAsset = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query.run('DELETE FROM outlet_assets WHERE id = ?', [id]);
    res.json({ success: true, message: 'Aset berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (deleteAsset):', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus aset.' });
  }
};

/**
 * 10. GET /api/assets/logs/all
 * List all historical asset activity logs
 */
exports.getAllAssetLogs = async (req, res) => {
  try {
    const { log_type, branch_id, limit = 50 } = req.query;
    let sql = `
      SELECT l.*, a.name as asset_name, a.asset_code, a.category as asset_category,
             fb.name as from_branch_name, fb.code as from_branch_code,
             tb.name as to_branch_name, tb.code as to_branch_code
      FROM outlet_asset_logs l
      JOIN outlet_assets a ON l.asset_id = a.id
      LEFT JOIN branches fb ON l.from_branch_id = fb.id
      LEFT JOIN branches tb ON l.to_branch_id = tb.id
      WHERE 1=1
    `;
    const params = [];

    if (log_type) {
      sql += ' AND l.log_type = ?';
      params.push(log_type);
    }
    if (branch_id) {
      sql += ' AND (l.from_branch_id = ? OR l.to_branch_id = ?)';
      params.push(parseInt(branch_id, 10), parseInt(branch_id, 10));
    }

    sql += ' ORDER BY l.id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await query.all(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : []
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('API Error (getAllAssetLogs):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat log aktivitas aset.' });
  }
};
