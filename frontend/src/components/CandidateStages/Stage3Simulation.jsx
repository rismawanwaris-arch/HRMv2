import React from 'react';

function Stage3Simulation({ candidate, stageData, setStageData, handleStageSubmit }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(3, stageData); }}>
      <div className="eval-title">
        <span>Tahap 3: Tes Simulasi & Role Play</span>
        <span className={`badge \${stageData.passed ? 'badge-hired' : 'badge-active'}`}>
          {stageData.passed ? 'Lolos' : 'Menunggu Evaluasi'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Skenario 1: Melayani Pembelian + Upselling Paket Data</span>
            <strong>Skor: {stageData.score_upselling} / 5</strong>
          </label>
          <input 
            type="range" min="1" max="5" 
            value={stageData.score_upselling} 
            onChange={(e) => setStageData(p => ({ ...p, score_upselling: parseInt(e.target.value) }))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>1 = Buruk (pasif)</span>
            <span>5 = Sempurna (persuasif, upselling berhasil)</span>
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Skenario 2: Menangani Komplain Transaksi Gagal</span>
            <strong>Skor: {stageData.score_complaint} / 5</strong>
          </label>
          <input 
            type="range" min="1" max="5" 
            value={stageData.score_complaint} 
            onChange={(e) => setStageData(p => ({ ...p, score_complaint: parseInt(e.target.value) }))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>1 = Emosional / Defensif</span>
            <span>5 = Sangat Empati, Tenang, Solutif</span>
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Skenario 3: Menangani Antrean Ramah & Cepat</span>
            <strong>Skor: {stageData.score_queue} / 5</strong>
          </label>
          <input 
            type="range" min="1" max="5" 
            value={stageData.score_queue} 
            onChange={(e) => setStageData(p => ({ ...p, score_queue: parseInt(e.target.value) }))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>1 = Gugup / Menurunkan Kualitas</span>
            <span>5 = Stabil, Cepat, Tetap Menyapa Pelanggan</span>
          </div>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="form-group">
          <label>Nama Evaluator (Supervisor / Kepala Toko)</label>
          <input 
            type="text" 
            value={stageData.evaluator || ''}
            onChange={(e) => setStageData(p => ({ ...p, evaluator: e.target.value }))}
            placeholder="Nama supervisor penilai..."
          />
        </div>
      </div>

      <div className="form-group form-group-full" style={{ marginBottom: '24px' }}>
        <label>Catatan & Evaluasi Perilaku</label>
        <textarea 
          value={stageData.notes || ''}
          onChange={(e) => setStageData(p => ({ ...p, notes: e.target.value }))}
          placeholder="Catatan kelebihan dan kekurangan kandidat saat melakukan simulasi pelayanan..."
          rows={3}
        />
      </div>

      <div className={`checklist-item \${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Nyatakan Lolos Tes Simulasi & Lanjut Wawancara HRD</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kandidat menunjukkan pelayanan yang memadai.</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary">Simpan Hasil Tahap 3</button>
      )}
    </form>
  );
}

export default Stage3Simulation;
