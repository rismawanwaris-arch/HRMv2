const { query } = require('../db');

exports.getSettings = async (req, res) => {
  try {
    const rows = await query.all('SELECT key, value FROM system_settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('API Error (get settings):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowed = ['payroll_period_start_day', 'payroll_period_end_day', 'working_days_per_month'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = String(parseInt(req.body[key], 10) || 0);
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, val]
        );
      }
    }
    res.json({ success: true, message: 'Pengaturan berhasil disimpan.' });
  } catch (error) {
    console.error('API Error (update settings):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getPenaltyRules = async (req, res) => {
  try {
    const rules = await query.all('SELECT * FROM late_penalty_rules ORDER BY min_count ASC');
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('API Error (get penalty rules):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createPenaltyRule = async (req, res) => {
  try {
    const { min_count, max_count, penalty_per_occurrence } = req.body;
    if (min_count === undefined || penalty_per_occurrence === undefined) {
      return res.status(400).json({ success: false, message: 'min_count dan penalty_per_occurrence wajib diisi.' });
    }
    const result = await query.run(
      'INSERT INTO late_penalty_rules (min_count, max_count, penalty_per_occurrence) VALUES (?, ?, ?)',
      [parseInt(min_count, 10), max_count != null ? parseInt(max_count, 10) : null, parseInt(penalty_per_occurrence, 10)]
    );
    const rule = await query.get('SELECT * FROM late_penalty_rules WHERE id = ?', [result.id]);
    res.json({ success: true, data: rule, message: 'Aturan denda berhasil ditambahkan.' });
  } catch (error) {
    console.error('API Error (create penalty rule):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updatePenaltyRule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { min_count, max_count, penalty_per_occurrence } = req.body;
    await query.run(
      'UPDATE late_penalty_rules SET min_count = ?, max_count = ?, penalty_per_occurrence = ? WHERE id = ?',
      [parseInt(min_count, 10), max_count != null ? parseInt(max_count, 10) : null, parseInt(penalty_per_occurrence, 10), id]
    );
    const rule = await query.get('SELECT * FROM late_penalty_rules WHERE id = ?', [id]);
    res.json({ success: true, data: rule, message: 'Aturan denda berhasil diperbarui.' });
  } catch (error) {
    console.error('API Error (update penalty rule):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deletePenaltyRule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query.run('DELETE FROM late_penalty_rules WHERE id = ?', [id]);
    res.json({ success: true, message: 'Aturan denda berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (delete penalty rule):', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
