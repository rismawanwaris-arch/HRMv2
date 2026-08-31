import React from 'react';

function Stage6MCU({ candidate, stageData, setStageData, handleStageSubmit, trainingStatements }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(6, stageData); }}>
      <div className="eval-title">
        <span>Tahap 6: Evaluasi & Tes Pasca Training</span>
        <span className={`badge \${stageData.passed ? 'badge-hired' : 'badge-active'}`}>
          {stageData.passed ? 'Lolos' : 'Menunggu Ujian'}
        </span>
      </div>

      {stageData.test_completed_at ? (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', color: 'white', margin: 0 }}>Hasil Evaluasi Kompetensi Training</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Dinilai pada: {new Date(stageData.test_completed_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB
            </span>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: stageData.passed ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {parseFloat((stageData.score_training / 10).toFixed(1))} / 10
            </div>
            <div>
              <div style={{ fontWeight: '600', color: 'white' }}>
                {stageData.passed ? 'LOLOS TRAINING (Memenuhi Passing Grade)' : 'TIDAK LULUS TRAINING (Di bawah Passing Grade)'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Nilai rata-rata dari seluruh indikator kompetensi (Passing grade minimal 6.5).
              </div>
            </div>
          </div>

          {/* Render statement details */}
          <h4 style={{ fontSize: '14px', color: 'white', marginBottom: '12px' }}>Rincian Skor Per Indikator:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(() => {
              try {
                const details = JSON.parse(stageData.training_details || '{}');
                return trainingStatements.map((stmt, idx) => {
                  const rating = details[stmt.id] || '-';
                  return (
                    <div key={stmt.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{idx + 1}. {stmt.statement_text}</span>
                      <strong style={{ color: 'white' }}>{rating} / 10</strong>
                    </div>
                  );
                });
              } catch (e) {
                return <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Format rincian nilai tidak didukung.</p>;
              }
            })()}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', marginBottom: '32px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Kandidat belum dievaluasi pada portal training.</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Gunakan "Portal Ujian Training" di sidebar, atau masukkan nilai rata-rata secara manual di bawah jika dilakukan offline.</p>
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Input Hasil Manual (Offline)</h3>
          <div className="form-grid" style={{ marginBottom: '24px' }}>
            <div className="form-group">
              <label>Skor Rata-rata Uji Pasca Training (Skala 1 - 10)</label>
              <input 
                type="number" 
                value={stageData.score_training ? parseFloat((stageData.score_training / 10).toFixed(1)) : 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  const pct = Math.round(val * 10);
                  setStageData(p => ({ ...p, score_training: pct, passed: val >= 6.5 ? 1 : 0 }));
                }}
                min="0" max="10" step="0.1"
              />
            </div>
          </div>
        </div>
      )}

      <div className="form-group form-group-full" style={{ marginBottom: '24px' }}>
        <label>Catatan & Umpan Balik Hasil Evaluasi Training</label>
        <textarea 
          value={stageData.ref_check_notes || ''}
          onChange={(e) => setStageData(p => ({ ...p, ref_check_notes: e.target.value }))}
          placeholder="Masukkan catatan kelebihan/kekurangan praktik kerja kandidat di sini..."
          rows={3}
        />
      </div>

      <div className={`checklist-item \${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Nyatakan Lolos Tes Pasca Training</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Melangkah ke tahap pembuatan Surat Penawaran Kerja (Offering).</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary">Simpan Hasil Tahap 6</button>
      )}
    </form>
  );
}

export default Stage6MCU;
