const { query } = require('../db');

const DEFAULT_DROPDOWN_OPTIONS = Object.freeze({
  asset_categories: [
    'Elektronik & HP',
    'Fasilitas & Mebel',
    'Branding & Neon Box',
    'Peralatan Kasir',
    'Keamanan & CCTV',
    'Operasional Lainnya',
  ],
  asset_conditions: [
    'Baik',
    'Rusak Ringan',
    'Rusak Berat',
    'Dalam Perbaikan',
  ],
  asset_statuses: [
    'Aktif',
    'Diganti',
    'Afkir/Scrap',
  ],
  visit_purposes: [
    'Audit Kebersihan & Keamanan',
    'Edukasi & Coaching Kasir',
    'Stock Opname & Cek Kas',
    'Patroli & Kunjungan Rutin',
    'Investigasi Insiden / Kerusakan',
    'Lainnya',
  ],
  incident_categories: [
    'Kerusakan Fasilitas',
    'Kebersihan',
    'Keamanan & Aset',
    'Operasional & Kasir',
    'Perilaku Karyawan',
    'Komplain Pelanggan',
    'Lainnya',
  ],
  incident_severities: [
    'Low',
    'Medium',
    'High',
    'Critical',
  ],
  incident_statuses: [
    'Open',
    'In Progress',
    'Resolved',
  ],
  reimbursement_categories: [
    'Transportasi',
    'Operasional Outlet',
    'Kesehatan / Medis',
    'Perlengkapan',
    'Lainnya',
  ],
  contract_types: [
    'PKWT',
    'PKWTT',
    'Freelance',
    'Magang',
  ],
});

const DROPDOWN_KEYS = Object.keys(DEFAULT_DROPDOWN_OPTIONS);
const STORAGE_PREFIX = 'dropdown_';
const MAX_ITEMS_PER_LIST = 50;
const MAX_ITEM_LENGTH = 80;

// Legacy mobile values still accepted during offline sync so older queued payloads are not silently overwritten
const LEGACY_INCIDENT_CATEGORIES = ['Fasilitas', 'Kehilangan', 'Operasional'];
const LEGACY_ASSET_STATUSES = ['Dalam Perbaikan', 'Dipensiunkan', 'Dimutasi'];

function sanitizeOptionList(rawList) {
  if (!Array.isArray(rawList)) return null;
  const seen = new Set();
  const cleaned = [];
  for (const item of rawList) {
    if (typeof item !== 'string' && typeof item !== 'number') continue;
    const trimmed = String(item).trim().slice(0, MAX_ITEM_LENGTH);
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    cleaned.push(trimmed);
    if (cleaned.length >= MAX_ITEMS_PER_LIST) break;
  }
  return cleaned;
}

async function getDropdownOptions() {
  const result = {};
  for (const key of DROPDOWN_KEYS) {
    result[key] = [...DEFAULT_DROPDOWN_OPTIONS[key]];
  }

  const rows = await query.all(
    "SELECT key, value FROM system_settings WHERE key LIKE 'dropdown_%'"
  );

  for (const row of rows) {
    const shortKey = row.key.slice(STORAGE_PREFIX.length);
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_DROPDOWN_OPTIONS, shortKey)) {
      continue;
    }
    try {
      const parsed = JSON.parse(row.value);
      const cleaned = sanitizeOptionList(parsed);
      if (cleaned && cleaned.length > 0) {
        result[shortKey] = cleaned;
      }
    } catch {
      // Fall back to default options if stored JSON is malformed
    }
  }

  return result;
}

async function saveDropdownOptions(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Payload dropdown options tidak valid.');
    err.status = 400;
    throw err;
  }

  const updates = [];
  for (const key of DROPDOWN_KEYS) {
    if (payload[key] === undefined) continue;
    const cleaned = sanitizeOptionList(payload[key]);
    if (!cleaned || cleaned.length === 0) {
      const err = new Error(`Daftar opsi untuk ${key} minimal harus memiliki 1 pilihan valid.`);
      err.status = 400;
      throw err;
    }
    updates.push([`${STORAGE_PREFIX}${key}`, JSON.stringify(cleaned)]);
  }

  if (updates.length === 0) {
    const err = new Error('Tidak ada kategori dropdown valid yang dikirim untuk disimpan.');
    err.status = 400;
    throw err;
  }

  for (const [storageKey, jsonValue] of updates) {
    await query.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [storageKey, jsonValue]
    );
  }

  return getDropdownOptions();
}

module.exports = {
  DEFAULT_DROPDOWN_OPTIONS,
  DROPDOWN_KEYS,
  LEGACY_INCIDENT_CATEGORIES,
  LEGACY_ASSET_STATUSES,
  sanitizeOptionList,
  getDropdownOptions,
  saveDropdownOptions,
};
