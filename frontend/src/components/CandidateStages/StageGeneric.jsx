import React from 'react';

function StageGeneric({ candidate, stageId, stageName, stageData, setStageData, handleStageSubmit }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(stageId, stageData); }}>
      <div className="eval-title">
        <span>Evaluasi: {stageName}</span>
        <span className={`badge ${stageData.passed ? 'badge-hired' : 'badge-active'}`}>
          {stageData.passed ? 'Lolos' : 'Proses'}
        </span>
      </div>

      <div className="form-group form-group-full" style={{ marginBottom: '24px' }}>
        <label>Catatan Evaluasi / Keterangan</label>
        <textarea 
          value={stageData.notes || ''}
          onChange={(e) => setStageData(p => ({ ...p, notes: e.target.value }))}
          placeholder={`Catatan hasil evaluasi untuk tahap ${stageName}...`}
          rows={4}
        />
      </div>

      <div className={`checklist-item ${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Nyatakan Lolos Tahap Ini</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Kandidat memenuhi syarat dan siap lanjut ke tahap berikutnya.</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary">Simpan Hasil Evaluasi</button>
      )}
    </form>
  );
}

export default StageGeneric;
