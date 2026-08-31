const { query } = require('../db');

/**
 * List audit-log entries, newest first, with optional filters.
 * Query params: entity_type, entity_id, actor, action, limit (<=200), offset.
 */
exports.getAuditLog = async (req, res) => {
  try {
    const { entity_type, entity_id, actor, action } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset), 10) || 0;

    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { sql += ' AND entity_id = ?'; params.push(parseInt(String(entity_id), 10)); }
    if (actor) { sql += ' AND actor = ?'; params.push(actor); }
    if (action) { sql += ' AND action = ?'; params.push(action); }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query.all(sql, params);
    const total = await query.get('SELECT COUNT(*) as count FROM audit_log');
    res.json({ success: true, data: rows, total: total.count, limit, offset });
  } catch (error) {
    console.error('API Error (audit log):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving audit log' });
  }
};
