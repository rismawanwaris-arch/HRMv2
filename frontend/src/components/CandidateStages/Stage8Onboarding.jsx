import React from 'react';

const numOrZero = (raw) => {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 0 : n;
};

const intOrZero = (raw) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
};

function Stage8Onboarding({ candidate, stageData, setStageData, handleStageSubmit, submitting = false }) {
  if (!candidate || candidate.status !== 'Hired') return null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit('onboarding', stageData); }}>
      <div className="eval-title">
        <span>★ Program Onboarding Karyawan Baru (90 Hari)</span>
        <span className="badge badge-hired">Onboarding Active</span>
      </div>

      <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--secondary)' }}>Evaluasi Berkala Program 30-60-90 Hari</h3>
      <div className="form-grid" style={{ marginBottom: '32px' }}>

        {/* 30 Days checkin */}
        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Evaluasi Hari ke-30</label>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Status Kelulusan</label>
            <select value={stageData.day_30_status || 'Pending'} onChange={(e) => setStageData(p => ({ ...p, day_30_status: e.target.value }))}>
              <option value="Pending">Dalam Proses</option>
              <option value="Passed">Lulus Orientasi</option>
              <option value="Failed">Gagal Orientasi</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Nilai Tes Produk (Hari ke-30)</label>
            <input type="number" value={stageData.day_30_score ?? 0} onChange={(e) => setStageData(p => ({ ...p, day_30_score: numOrZero(e.target.value) }))} min="0" max="100" />
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Catatan Feedback</label>
            <textarea value={stageData.day_30_notes || ''} onChange={(e) => setStageData(p => ({ ...p, day_30_notes: e.target.value }))} rows={2} placeholder="Feedback lisan Kepala Toko..." />
          </div>
        </div>

        {/* 60 Days checkin */}
        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Evaluasi Hari ke-60</label>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Status Kelulusan</label>
            <select value={stageData.day_60_status || 'Pending'} onChange={(e) => setStageData(p => ({ ...p, day_60_status: e.target.value }))}>
              <option value="Pending">Dalam Proses</option>
              <option value="Passed">Lulus Review Tengah</option>
              <option value="Failed">Butuh PIP Ringan</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Skor Review KPI 60 Hari</label>
            <input type="number" value={stageData.day_60_score ?? 0} onChange={(e) => setStageData(p => ({ ...p, day_60_score: numOrZero(e.target.value) }))} min="0" max="100" />
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Catatan Area Pengembangan</label>
            <textarea value={stageData.day_60_notes || ''} onChange={(e) => setStageData(p => ({ ...p, day_60_notes: e.target.value }))} rows={2} placeholder="Saran perbaikan kinerja..." />
          </div>
        </div>

        {/* 90 Days checkin */}
        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Evaluasi Hari ke-90 (Final)</label>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Status Akhir Probasi</label>
            <select value={stageData.day_90_status || 'Pending'} onChange={(e) => setStageData(p => ({ ...p, day_90_status: e.target.value }))}>
              <option value="Pending">Menunggu Review Akhir</option>
              <option value="Passed">Lanjut Karyawan Tetap (PKWTT)</option>
              <option value="Failed">Kontrak Dihentikan</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Skor KPI Akhir 90 Hari</label>
            <input type="number" value={stageData.day_90_score ?? 0} onChange={(e) => setStageData(p => ({ ...p, day_90_score: numOrZero(e.target.value) }))} min="0" max="100" />
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Keputusan / Catatan Evaluasi</label>
            <textarea value={stageData.day_90_notes || ''} onChange={(e) => setStageData(p => ({ ...p, day_90_notes: e.target.value }))} rows={2} placeholder="Keputusan status kepegawaian..." />
          </div>
        </div>

      </div>

      <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--color-success)' }}>Pencapaian KPI Realisasi vs Target</h3>
      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="form-group">
          <label>Akurasi Transaksi (Kasir) - Target ≥ 99%</label>
          <input type="number" step="0.1" value={stageData.kpi_akurasi_transaksi ?? 100} onChange={(e) => setStageData(p => ({ ...p, kpi_akurasi_transaksi: numOrZero(e.target.value) }))} placeholder="99.5" />
        </div>
        <div className="form-group">
          <label>Kehadiran & Ketepatan Waktu - Target ≥ 95%</label>
          <input type="number" step="0.1" value={stageData.kpi_kehadiran ?? 100} onChange={(e) => setStageData(p => ({ ...p, kpi_kehadiran: numOrZero(e.target.value) }))} placeholder="98.2" />
        </div>
        <div className="form-group">
          <label>Skor Penguasaan Produk - Target ≥ 75</label>
          <input type="number" value={stageData.kpi_penguasaan_produk ?? 75} onChange={(e) => setStageData(p => ({ ...p, kpi_penguasaan_produk: numOrZero(e.target.value) }))} placeholder="80" />
        </div>
        <div className="form-group">
          <label>Jumlah Komplain Pelanggan - Target ≤ 1x/bulan</label>
          <input type="number" value={stageData.kpi_kepuasan_pelanggan ?? 0} onChange={(e) => setStageData(p => ({ ...p, kpi_kepuasan_pelanggan: intOrZero(e.target.value) }))} placeholder="0" />
        </div>
        <div className="form-group">
          <label>Persentase Laporan Tepat Waktu - Target 100%</label>
          <input type="number" step="0.1" value={stageData.kpi_laporan_harian ?? 100} onChange={(e) => setStageData(p => ({ ...p, kpi_laporan_harian: numOrZero(e.target.value) }))} placeholder="100.0" />
        </div>
        <div className="form-group">
          <label>Rata-rata Upselling Paket/Hari - Target ≥ 1 paket/hari</label>
          <input type="number" step="0.1" value={stageData.kpi_upselling ?? 1} onChange={(e) => setStageData(p => ({ ...p, kpi_upselling: numOrZero(e.target.value) }))} placeholder="1.4" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Menyimpan...' : 'Simpan Laporan Onboarding'}
      </button>
    </form>
  );
}

export default Stage8Onboarding;
