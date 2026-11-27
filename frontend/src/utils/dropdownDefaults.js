export const DEFAULT_DROPDOWN_OPTIONS = {
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
};

export function withCurrentOption(list, current) {
  const arr = Array.isArray(list) ? list : [];
  if (current && !arr.includes(current)) {
    return [...arr, current];
  }
  return arr;
}
