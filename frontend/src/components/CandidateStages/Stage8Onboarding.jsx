import React from 'react';

function Stage8Onboarding({ candidate, stageData, setStageData, handleStageSubmit }) {
  if (candidate.status !== 'Hired') return null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(8, stageData); }}>
      <div className="eval-title">
        <span>★ Program Onboarding Karyawan Baru (90 Hari)</span>
        <span className="badge badge-hired">Onboarding Active</span>
      </div>

      <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--secondary)' }}>Evaluasi Berkala Program 30-60-90 Hari</h3>
      <div className="form-grid" style={{ marginBottom: '32px' }}>
        
        {/* 30 Days checkin */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: '700', color: 'white' }}>Evaluasi Hari ke-30</label>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Status Kelulusan</label>
            <select value={stageData.day_30_status} onChange={(e) => setStageData(p => ({ ...p, day_30_status: e.target.value }))}>
              <option value="Pending">Dalam Proses</option>
              <option value="Passed">Lulus Orientasi</option>
              <option value="Failed">Gagal Orientasi</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Nilai Tes Produk (Hari ke-30)</label>
            <input type="number" value={stageData.day_30_score} onChange={(e) => setStageData(p => ({ ...p, day_30_score: parseFloat(e.target.value) || 0 }))} min="0" max="100" />
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Catatan Feedback</label>
            <textarea value={stageData.day_30_notes || ''} onChange={(e) => setStageData(p => ({ ...p, day_30_notes: e.target.value }))} rows={2} placeholder="Feedback lisan Kepala Toko..." />
          </div>
        </div>

        {/* 60 Days checkin */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: '700', color: 'white' }}>Evaluasi Hari ke-60</label>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Status Kelulusan</label>
            <select value={stageData.day_60_status} onChange={(e) => setStageData(p => ({ ...p, day_60_status: e.target.value }))}>
              <option value="Pending">Dalam Proses</option>
              <option value="Passed">Lulus Review Tengah</option>
              <option value="Failed">Butuh PIP Ringan</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Skor Review KPI 60 Hari</label>
            <input type="number" value={stageData.day_60_score} onChange={(e) => setStageData(p => ({ ...p, day_60_score: parseFloat(e.target.value) || 0 }))} min="0" max="100" />
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Catatan Area Pengembangan</label>
            <textarea value={stageData.day_60_notes || ''} onChange={(e) => setStageData(p => ({ ...p, day_60_notes: e.target.value }))} rows={2} placeholder="Saran perbaikan kinerja..." />
          </div>
        </div>

        {/* 90 Days checkin */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontWeight: '700', color: 'white' }}>Evaluasi Hari ke-90 (Final)</label>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Status Akhir Probasi</label>
            <select value={stageData.day_90_status} onChange={(e) => setStageData(p => ({ ...p, day_90_status: e.target.value }))}>
              <option value="Pending">Menunggu Review Akhir</option>
              <option value="Passed">Lanjut Karyawan Tetap (PKWTT)</option>
              <option value="Failed">Kontrak Dihentikan</option>
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>Skor KPI Akhir 90 Hari</label>
            <input type="number" value={stageData.day_90_score} onChange={(e) => setStageData(p => ({ ...p, day_90_score: parseFloat(e.target.value) || 0 }))} min="0" max="100" />
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
          <input type="number" step="0.1" value={stageData.kpi_akurasi_transaksi} onChange={(e) => setStageData(p => ({ ...p, kpi_akurasi_transaksi: parseFloat(e.target.value) || 0 }))} placeholder="99.5" />
        </div>
        <div className="form-group">
          <label>Kehadiran & Ketepatan Waktu - Target ≥ 95%</label>
          <input type="number" step="0.1" value={stageData.kpi_kehadiran} onChange={(e) => setStageData(p => ({ ...p, kpi_kehadiran: parseFloat(e.target.value) || 0 }))} placeholder="98.2" />
        </div>
        <div className="form-group">
          <label>Skor Penguasaan Produk - Target ≥ 75</label>
          <input type="number" value={stageData.kpi_penguasaan_produk} onChange={(e) => setStageData(p => ({ ...p, kpi_penguasaan_produk: parseFloat(e.target.value) || 0 }))} placeholder="80" />
        </div>
        <div className="form-group">
          <label>Jumlah Komplain Pelanggan - Target ≤ 1x/bulan</label>
          <input type="number" value={stageData.kpi_kepuasan_pelanggan} onChange={(e) => setStageData(p => ({ ...p, kpi_kepuasan_pelanggan: parseInt(e.target.value) || 0 }))} placeholder="0" />
        </div>
        <div className="form-group">
          <label>Persentase Laporan Tepat Waktu - Target 100%</label>
          <input type="number" step="0.1" value={stageData.kpi_laporan_harian} onChange={(e) => setStageData(p => ({ ...p, kpi_laporan_harian: parseFloat(e.target.value) || 0 }))} placeholder="100.0" />
        </div>
        <div className="form-group">
          <label>Rata-rata Upselling Paket/Hari - Target ≥ 1 paket/hari</label>
          <input type="number" step="0.1" value={stageData.kpi_upselling} onChange={(e) => setStageData(p => ({ ...p, kpi_upselling: parseFloat(e.target.value) || 0 }))} placeholder="1.4" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary">Simpan Laporan Onboarding</button>
    </form>
  );
}

export default Stage8Onboarding;
