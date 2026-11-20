import React from 'react';

function Stage5User({ candidate, stageId = 5, stageData, setStageData, handleStageSubmit, submitting = false }) {
  const decision = stageData.decision || 'Pending';
  const badgeClass = decision === 'Recommended'
    ? 'badge-hired'
    : decision === 'Not Recommended'
    ? 'badge-rejected'
    : 'badge-active';

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(stageId, stageData); }}>
      <div className="eval-title">
        <span>Tahap 5: Wawancara User (Kepala Toko / Area Supervisor)</span>
        <span className={`badge ${badgeClass}`}>
          {decision === 'Recommended' ? 'Direkomendasikan' : decision === 'Not Recommended' ? 'Ditolak' : 'Menunggu Umpan Balik'}
        </span>
      </div>

      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="form-group">
          <label>Keputusan Akhir Kepala Toko</label>
          <select
            value={decision}
            onChange={(e) => {
              const d = e.target.value;
              setStageData(p => ({ ...p, decision: d, passed: d === 'Recommended' ? 1 : 0 }));
            }}
          >
            <option value="Pending">Menunggu Keputusan</option>
            <option value="Recommended">Recommended (Lulus)</option>
            <option value="Not Recommended">Not Recommended (Gagal)</option>
          </select>
        </div>
      </div>

      <div className="form-group form-group-full" style={{ marginBottom: '24px' }}>
        <label>Catatan User & Kesesuaian Operasional Toko</label>
        <textarea
          value={stageData.notes || ''}
          onChange={(e) => setStageData(p => ({ ...p, notes: e.target.value }))}
          placeholder="Catatan kecocokan pelamar dengan kondisi dan shift gerai retail konter..."
          rows={4}
        />
      </div>

      <div className={`checklist-item ${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Nyatakan Lolos Wawancara User</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kandidat disetujui Kepala Toko untuk masuk ke MCU & Pengecekan Referensi.</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Menyimpan...' : 'Simpan Hasil Tahap 5'}
        </button>
      )}
    </form>
  );
}

export default Stage5User;
