import React from 'react';

function Stage7Offering({ candidate, stageData, setStageData, handleStageSubmit }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(7, stageData); }}>
      <div className="eval-title">
        <span>Tahap 7: Offering & Kontrak Kerja</span>
        <span className={`badge \${stageData.offering_status === 'Accepted' ? 'badge-hired' : 'badge-active'}`}>
          {stageData.offering_status}
        </span>
      </div>

      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="form-group">
          <label>Tipe Kontrak Kerja</label>
          <select name="contract_type" value={stageData.contract_type} 
                  onChange={(e) => setStageData(p => ({ ...p, contract_type: e.target.value }))}>
            <option value="PKWT">PKWT (Kontrak / Masa Percobaan)</option>
            <option value="PKWTT">PKWTT (Pegawai Tetap)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Tanggal Mulai Bekerja</label>
          <input 
            type="date" 
            value={stageData.start_date || ''}
            onChange={(e) => setStageData(p => ({ ...p, start_date: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Gaji Pokok yang Ditawarkan (Rp)</label>
          <input 
            type="number" 
            value={stageData.salary_offered}
            onChange={(e) => setStageData(p => ({ ...p, salary_offered: parseFloat(e.target.value) || 0 }))}
            placeholder="Contoh: 2800000"
          />
        </div>
        <div className="form-group">
          <label>Tunjangan / Uang Makan (Rp)</label>
          <input 
            type="number" 
            value={stageData.allowance}
            onChange={(e) => setStageData(p => ({ ...p, allowance: parseFloat(e.target.value) || 0 }))}
            placeholder="Contoh: 500000"
          />
        </div>
        <div className="form-group form-group-full">
          <label>Skema Bonus & Insentif Penjualan</label>
          <textarea 
            value={stageData.bonus_scheme || ''}
            onChange={(e) => setStageData(p => ({ ...p, bonus_scheme: e.target.value }))}
            placeholder="Masukkan skema insentif jika berhasil upselling voucher / aksesoris..."
            rows={2}
          />
        </div>
        <div className="form-group">
          <label>Status Penawaran (Offering Status)</label>
          <select 
            value={stageData.offering_status} 
            onChange={(e) => {
              const s = e.target.value;
              setStageData(p => ({ ...p, offering_status: s, passed: s === 'Accepted' ? 1 : 0 }));
            }}
          >
            <option value="Pending">Pending (Sedang Dikirim)</option>
            <option value="Accepted">Accepted (Diterima Kandidat)</option>
            <option value="Declined">Declined (Ditolak Kandidat)</option>
          </select>
        </div>
      </div>

      <div className={`checklist-item \${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Tanda Tangani Kontrak & Resmi Rekrut Karyawan (Hired)</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Centang ini dan pastikan status "Accepted" untuk memindahkan kandidat ke status Hired dan mengaktifkan Monitoring Onboarding.</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary">Simpan Kelulusan Akhir</button>
      )}
    </form>
  );
}

export default Stage7Offering;
