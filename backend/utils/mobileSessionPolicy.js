const { query } = require('../db');

const POLICY_DEFAULTS = {
  token_ttl_hours: Math.max(1, parseInt(process.env.MOBILE_TOKEN_TTL_HOURS || '12', 10) || 12),
  idle_timeout_minutes: 30,
  app_lock_minutes: 5,
  offline_cache_ttl_hours: 24,
  require_app_lock: true,
  wipe_cache_on_logout: true,
  allow_offline_read: true,
  single_device_mode: false,
};

const POLICY_INT_RANGES = {
  mobile_token_ttl_hours: { field: 'token_ttl_hours', min: 1, max: 168 },
  mobile_idle_timeout_minutes: { field: 'idle_timeout_minutes', min: 1, max: 1440 },
  mobile_app_lock_minutes: { field: 'app_lock_minutes', min: 1, max: 60 },
  mobile_offline_cache_ttl_hours: { field: 'offline_cache_ttl_hours', min: 1, max: 168 },
};

const POLICY_BOOL_KEYS = {
  mobile_require_app_lock: 'require_app_lock',
  mobile_wipe_cache_on_logout: 'wipe_cache_on_logout',
  mobile_allow_offline_read: 'allow_offline_read',
  mobile_single_device_mode: 'single_device_mode',
};

const ALL_POLICY_DB_KEYS = [
  ...Object.keys(POLICY_INT_RANGES),
  ...Object.keys(POLICY_BOOL_KEYS),
];

function parseBoolSetting(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === '1' || s === 'true') return true;
  if (s === '0' || s === 'false') return false;
  return fallback;
}

/**
 * Load effective mobile session policy from system_settings (falling back to safe defaults).
 * @returns {Promise<Object>}
 */
async function getMobileSessionPolicy() {
  const envDefaultHours = Math.max(1, Math.min(168, parseInt(process.env.MOBILE_TOKEN_TTL_HOURS || '12', 10) || 12));
  const policy = {
    ...POLICY_DEFAULTS,
    token_ttl_hours: envDefaultHours,
  };

  try {
    const placeholders = ALL_POLICY_DB_KEYS.map(() => '?').join(', ');
    const rows = await query.all(
      `SELECT key, value FROM system_settings WHERE key IN (${placeholders})`,
      ALL_POLICY_DB_KEYS
    );
    const map = {};
    for (const r of rows) map[r.key] = r.value;

    for (const [dbKey, { field, min, max }] of Object.entries(POLICY_INT_RANGES)) {
      if (map[dbKey] !== undefined && map[dbKey] !== '') {
        const parsed = parseInt(map[dbKey], 10);
        if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
          policy[field] = parsed;
        }
      }
    }

    for (const [dbKey, field] of Object.entries(POLICY_BOOL_KEYS)) {
      if (map[dbKey] !== undefined) {
        policy[field] = parseBoolSetting(map[dbKey], policy[field]);
      }
    }
  } catch (err) {
    // During early bootstrap or if system_settings is unavailable, fall back to defaults
    console.error('Failed to load mobile session policy, using defaults:', err.message);
  }

  return policy;
}

module.exports = {
  POLICY_DEFAULTS,
  POLICY_INT_RANGES,
  POLICY_BOOL_KEYS,
  ALL_POLICY_DB_KEYS,
  getMobileSessionPolicy,
};
