const os = require('os');
const { query } = require('../db');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

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
    const intKeys = ['payroll_period_start_day', 'payroll_period_end_day', 'working_days_per_month'];
    const timeKeys = ['shift_pagi_cutoff', 'shift_siang_cutoff'];

    for (const key of intKeys) {
      if (req.body[key] !== undefined) {
        const val = String(parseInt(req.body[key], 10) || 0);
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, val]
        );
      }
    }

    for (const key of timeKeys) {
      if (req.body[key] !== undefined) {
        // Validate HH:MM format
        const val = String(req.body[key]).trim();
        if (!/^\d{2}:\d{2}$/.test(val)) continue;
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, val]
        );
      }
    }

    if (req.body.mobile_api_base_url !== undefined) {
      const val = String(req.body.mobile_api_base_url).trim();
      await query.run(
        'INSERT INTO system_settings (key, value, updated_at) VALUES ("mobile_api_base_url", ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [val]
      );
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

/**
 * GET /api/settings/mobile-config
 * Mengembalikan info jaringan server untuk koneksi aplikasi Android Flutter
 */
exports.getMobileConfig = async (req, res) => {
  try {
    const port = process.env.PORT || '5001';
    const localIp = getLocalIpAddress();
    const customUrlRow = await query.get('SELECT value FROM system_settings WHERE key = "mobile_api_base_url"');
    const customBaseUrl = customUrlRow ? customUrlRow.value : '';

    const assetSync = await query.get('SELECT COUNT(*) as count FROM outlet_assets WHERE client_uuid IS NOT NULL');
    const visitSync = await query.get('SELECT COUNT(*) as count FROM outlet_visits WHERE client_uuid IS NOT NULL');
    const incidentSync = await query.get('SELECT COUNT(*) as count FROM outlet_incidents WHERE client_uuid IS NOT NULL');
    const empSync = await query.get('SELECT COUNT(*) as count FROM candidates WHERE client_uuid IS NOT NULL');

    res.json({
      success: true,
      data: {
        detected_ip: localIp,
        port: parseInt(port, 10),
        recommended_base_url: `http://${localIp}:${port}/api`,
        emulator_base_url: `http://10.0.2.2:${port}/api`,
        custom_base_url: customBaseUrl || `http://${localIp}:${port}/api`,
        sync_stats: {
          synced_assets: assetSync ? assetSync.count : 0,
          synced_visits: visitSync ? visitSync.count : 0,
          synced_incidents: incidentSync ? incidentSync.count : 0,
          synced_employees: empSync ? empSync.count : 0
        }
      }
    });
  } catch (error) {
    console.error('API Error (getMobileConfig):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat konfigurasi mobile API.' });
  }
};

