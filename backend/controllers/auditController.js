const { query } = require('../db');

/**
 * List audit-log entries, newest first, with optional filters.
 * Query params: entity_type, entity_id, actor, action, limit (<=200), offset.
 */
exports.getAuditLog = async (req, res) => {
  try {
    const { entity_type, entity_id, actor, action } = req.query;
    const rawLimit = parseInt(String(req.query.limit), 10);
    const rawOffset = parseInt(String(req.query.offset), 10);
    const limit = Math.max(1, Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 200));
    const offset = Math.max(0, Number.isNaN(rawOffset) ? 0 : rawOffset);

    let where = ' WHERE 1=1';
    const filterParams = [];
    if (entity_type) { where += ' AND entity_type = ?'; filterParams.push(entity_type); }
    if (entity_id !== undefined && entity_id !== '' && /^\d+$/.test(String(entity_id))) {
      where += ' AND entity_id = ?';
      filterParams.push(parseInt(String(entity_id), 10));
    }
    if (actor) { where += ' AND actor = ?'; filterParams.push(actor); }
    if (action) { where += ' AND action = ?'; filterParams.push(action); }

    const rows = await query.all(
      `SELECT * FROM audit_log${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...filterParams, limit, offset]
    );
    const total = await query.get(`SELECT COUNT(*) as count FROM audit_log${where}`, filterParams);
    res.json({ success: true, data: rows, total: total.count, limit, offset });
  } catch (error) {
    console.error('API Error (audit log):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving audit log' });
  }
};
