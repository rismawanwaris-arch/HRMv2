const { query } = require('../db');

/**
 * Retrieve all registered recruitment stages sorted by order number.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
exports.getStages = async (req, res) => {
  try {
    const stages = await query.all('SELECT * FROM recruitment_stages ORDER BY order_num ASC');
    res.json({ success: true, data: stages });
  } catch (error) {
    console.error('API Error (get stages):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving stages' });
  }
};

/**
 * Create/add a custom recruitment stage.
 * @param {import('express').Request} req - Express request object.
 * @param {Object} req.body - Stage input fields.
 * @param {string} req.body.name - Recruitment stage name.
 * @param {string} [req.body.code] - Short code identifier (generated if omitted).
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
exports.addStage = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama stage wajib diisi' });

    // Determine code: generate unique custom code if not provided
    const stageCode = code || `custom_${Date.now()}`;

    // Get max order_num
    const maxOrder = await query.get('SELECT MAX(order_num) as max_order FROM recruitment_stages');
    const orderNum = (maxOrder.max_order || 0) + 1;

    const result = await query.run(
      'INSERT INTO recruitment_stages (name, code, order_num, is_active) VALUES (?, ?, ?, 1)',
      [name, stageCode, orderNum]
    );

    res.status(201).json({
      success: true,
      message: 'Stage berhasil ditambahkan',
      data: { id: result.id, name, code: stageCode, order_num: orderNum, is_active: 1 }
    });
  } catch (error) {
    console.error('API Error (add stage):', error);
    res.status(500).json({ success: false, message: 'Server error adding stage' });
  }
};

/**
 * Update an existing recruitment stage's properties (rename, change order, active/inactive).
 * @param {import('express').Request} req - Express request object.
 * @param {Object} req.params - Request URL parameters.
 * @param {string} req.params.id - Stage ID to update.
 * @param {Object} req.body - Stage fields to modify.
 * @param {string} [req.body.name] - New stage name.
 * @param {boolean} [req.body.is_active] - Active toggle status.
 * @param {number} [req.body.order_num] - Sorted order index.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
exports.updateStage = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, is_active, order_num } = req.body;

    const existing = await query.get('SELECT * FROM recruitment_stages WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Stage tidak ditemukan' });

    const newName = name !== undefined ? name : existing.name;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
    const newOrder = order_num !== undefined ? order_num : existing.order_num;

    await query.run(
      'UPDATE recruitment_stages SET name = ?, is_active = ?, order_num = ? WHERE id = ?',
      [newName, newActive, newOrder, id]
    );

    res.json({ success: true, message: 'Stage berhasil diperbarui' });
  } catch (error) {
    console.error('API Error (update stage):', error);
    res.status(500).json({ success: false, message: 'Server error updating stage' });
  }
};

// Built-in stages
const builtInCodes = ['admin', 'written', 'simulation', 'interview_hrd', 'interview_user', 'mcu_ref', 'offering'];

/**
 * Delete a custom recruitment stage.
 * Built-in stages cannot be deleted, only deactivated.
 * @param {import('express').Request} req - Express request object.
 * @param {Object} req.params - Request URL parameters.
 * @param {string} req.params.id - Stage ID.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
exports.deleteStage = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const stage = await query.get('SELECT * FROM recruitment_stages WHERE id = ?', [id]);
    if (!stage) return res.status(404).json({ success: false, message: 'Stage tidak ditemukan' });

    if (builtInCodes.includes(stage.code)) {
      return res.status(400).json({ success: false, message: 'Stage sistem tidak dapat dihapus, hanya dapat dinonaktifkan.' });
    }

    await query.run('DELETE FROM recruitment_stages WHERE id = ?', [id]);
    // Cleanup linked generic evaluations
    await query.run('DELETE FROM stage_generic_evaluations WHERE stage_id = ?', [id]);

    res.json({ success: true, message: 'Stage berhasil dihapus' });
  } catch (error) {
    console.error('API Error (delete stage):', error);
    res.status(500).json({ success: false, message: 'Server error deleting stage' });
  }
};

/**
 * Reorder recruitment stages mapping order values.
 * @param {import('express').Request} req - Express request object.
 * @param {Object} req.body - Ordered stage inputs.
 * @param {Array<number>} req.body.stageIds - Array of stage IDs in sorted sequence.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
exports.reorderStages = async (req, res) => {
  try {
    const { stageIds } = req.body;
    if (!Array.isArray(stageIds)) return res.status(400).json({ success: false, message: 'Data urutan tidak valid' });

    for (let i = 0; i < stageIds.length; i++) {
      await query.run('UPDATE recruitment_stages SET order_num = ? WHERE id = ?', [i + 1, stageIds[i]]);
    }

    res.json({ success: true, message: 'Urutan stage berhasil diperbarui' });
  } catch (error) {
    console.error('API Error (reorder stages):', error);
    res.status(500).json({ success: false, message: 'Server error reordering stages' });
  }
};
