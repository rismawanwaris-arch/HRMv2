const os = require('os');
const { query } = require('../db');
const {
  DEFAULT_DROPDOWN_OPTIONS,
  getDropdownOptions,
  saveDropdownOptions,
} = require('../utils/dropdownOptions');

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

function isAllowedCleartextHost(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true; // RFC1918 10.0.0.0/8
  if (a === 192 && b === 168) return true; // RFC1918 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 172.16.0.0/12
  if (a === 100 && b >= 64 && b <= 127) return true; // Tailscale CGNAT 100.64.0.0/10
  return false;
}

function isSafeMobileBaseUrl(raw) {
  const val = String(raw || '').trim();
  if (!val) return true;
  if (val.length > 256) return false;
  let parsed;
  try {
    parsed = new URL(val);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password || !parsed.hostname) return false;
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') return isAllowedCleartextHost(parsed.hostname);
  return false;
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
        const parsed = parseInt(req.body[key], 10);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 31) {
          return res.status(400).json({
            success: false,
            message: `Nilai ${key} harus berupa angka antara 1 sampai 31.`,
          });
        }
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, String(parsed)]
        );
      }
    }

    for (const key of timeKeys) {
      if (req.body[key] !== undefined) {
        // Validate HH:MM format
        const val = String(req.body[key]).trim();
        if (!/^\d{2}:\d{2}$/.test(val)) {
          return res.status(400).json({ success: false, message: `Format jam ${key} harus HH:MM.` });
        }
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, val]
        );
      }
    }

    if (req.body.mobile_api_base_url !== undefined) {
      const val = String(req.body.mobile_api_base_url).trim();
      if (!isSafeMobileBaseUrl(val)) {
        return res.status(400).json({
          success: false,
          message: 'mobile_api_base_url tidak valid. Gunakan HTTPS untuk domain publik, atau HTTP hanya untuk localhost/LAN/Tailscale.',
        });
      }
      await query.run(
        "INSERT INTO system_settings (key, value, updated_at) VALUES ('mobile_api_base_url', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [val]
      );
    }

    const boolKeys = ['bpjs_payroll_enabled', 'pph21_payroll_enabled'];
    for (const key of boolKeys) {
      if (req.body[key] !== undefined) {
        const val = (req.body[key] === true || req.body[key] === '1' || req.body[key] === 1) ? '1' : '0';
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, val]
        );
      }
    }

    const floatRangeRules = {
      bpjs_kes_emp_rate: [0, 20],
      bpjs_kes_company_rate: [0, 20],
      bpjs_jht_emp_rate: [0, 20],
      bpjs_jht_company_rate: [0, 20],
      bpjs_jp_emp_rate: [0, 20],
      bpjs_jp_company_rate: [0, 20],
      bpjs_jkk_rate: [0, 20],
      bpjs_jkm_rate: [0, 20],
      bpjs_kes_cap: [0, 1000000000],
      bpjs_jp_cap: [0, 1000000000],
      contract_reminder_days: [1, 365],
      annual_leave_quota: [0, 60],
      overtime_hourly_divisor: [1, 500],
    };
    for (const [key, [minV, maxV]] of Object.entries(floatRangeRules)) {
      if (req.body[key] !== undefined) {
        const parsed = parseFloat(req.body[key]);
        if (!Number.isFinite(parsed) || parsed < minV || parsed > maxV) {
          return res.status(400).json({
            success: false,
            message: `Nilai ${key} harus berada di antara ${minV} sampai ${maxV}.`,
          });
        }
        await query.run(
          'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, String(parsed)]
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
    const minVal = parseInt(min_count, 10);
    const maxVal = (max_count !== undefined && max_count !== null && String(max_count).trim() !== '')
      ? parseInt(max_count, 10)
      : null;
    const penVal = parseInt(penalty_per_occurrence, 10);

    if (Number.isNaN(minVal) || minVal < 1 || Number.isNaN(penVal) || penVal < 0) {
      return res.status(400).json({ success: false, message: 'min_count (>= 1) dan penalty_per_occurrence (>= 0) harus berupa angka valid.' });
    }
    if (maxVal !== null && (Number.isNaN(maxVal) || maxVal < minVal)) {
      return res.status(400).json({ success: false, message: 'Batas maksimal keterlambatan (max_count) harus >= batas minimal.' });
    }

    const result = await query.run(
      'INSERT INTO late_penalty_rules (min_count, max_count, penalty_per_occurrence) VALUES (?, ?, ?)',
      [minVal, maxVal, penVal]
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
    const existing = await query.get('SELECT * FROM late_penalty_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Aturan denda tidak ditemukan.' });
    }

    const { min_count, max_count, penalty_per_occurrence } = req.body;
    const minVal = parseInt(min_count, 10);
    const maxVal = (max_count !== undefined && max_count !== null && String(max_count).trim() !== '')
      ? parseInt(max_count, 10)
      : null;
    const penVal = parseInt(penalty_per_occurrence, 10);

    if (Number.isNaN(minVal) || minVal < 1 || Number.isNaN(penVal) || penVal < 0) {
      return res.status(400).json({ success: false, message: 'min_count (>= 1) dan penalty_per_occurrence (>= 0) harus berupa angka valid.' });
    }
    if (maxVal !== null && (Number.isNaN(maxVal) || maxVal < minVal)) {
      return res.status(400).json({ success: false, message: 'Batas maksimal keterlambatan (max_count) harus >= batas minimal.' });
    }

    await query.run(
      'UPDATE late_penalty_rules SET min_count = ?, max_count = ?, penalty_per_occurrence = ? WHERE id = ?',
      [minVal, maxVal, penVal, id]
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
    const del = await query.run('DELETE FROM late_penalty_rules WHERE id = ?', [id]);
    if (del.changes === 0) {
      return res.status(404).json({ success: false, message: 'Aturan denda tidak ditemukan.' });
    }
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
    const port = process.env.PORT || '5002';
    const localIp = getLocalIpAddress();
    const customUrlRow = await query.get("SELECT value FROM system_settings WHERE key = 'mobile_api_base_url'");
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

/**
 * GET /api/dropdown-options (staff+) & GET /api/settings/dropdown-options (master)
 * Single source of truth untuk seluruh dropdown Web & Mobile.
 */
exports.getDropdownOptions = async (req, res) => {
  try {
    const data = await getDropdownOptions();
    res.json({
      success: true,
      data,
      defaults: DEFAULT_DROPDOWN_OPTIONS,
    });
  } catch (error) {
    console.error('API Error (getDropdownOptions):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat opsi dropdown.' });
  }
};

/**
 * PUT /api/settings/dropdown-options (master only)
 * Memperbarui opsi dropdown yang otomatis sinkron ke Website dan Mobile API.
 */
exports.updateDropdownOptions = async (req, res) => {
  try {
    const data = await saveDropdownOptions(req.body);
    res.json({
      success: true,
      message: 'Opsi dropdown berhasil disimpan dan disinkronkan ke Web & Mobile.',
      data,
      defaults: DEFAULT_DROPDOWN_OPTIONS,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('API Error (updateDropdownOptions):', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan opsi dropdown.' });
  }
};

