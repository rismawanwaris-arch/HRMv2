import React from 'react';

function Stage4HRD({ candidate, stageData, setStageData, handleStageSubmit, calcHRDWeightedScore }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(4, stageData); }}>
      <div className="eval-title">
        <span>Tahap 4: Wawancara Terstruktur HRD (BEI)</span>
        <span className={`badge \${stageData.passed ? 'badge-hired' : 'badge-active'}`}>
          {stageData.passed ? `Lolos (Rata-rata Terbobot: \${stageData.total_weighted_score})` : 'Menunggu Evaluasi'}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Gali jawaban dengan metode <strong>STAR</strong> (Situation, Task, Action, Result). Penilaian 1 - 5 (5 = Sangat Baik).
      </p>

      <table className="interview-scoring-table" style={{ marginBottom: '24px' }}>
        <thead>
          <tr>
            <th>Kompetensi Inti</th>
            <th>Bobot</th>
            <th>Skor (1-5)</th>
            <th>Sub-kalkulasi</th>
          </tr>
        </thead>
        <tbody>
          {[
            { key: 'score_integritas', label: 'Integritas & Kejujuran', weight: 0.25 },
            { key: 'score_pelayanan', label: 'Orientasi Pelayanan', weight: 0.20 },
            { key: 'score_ketelitian', label: 'Ketelitian & Akurasi', weight: 0.20 },
            { key: 'score_belajar', label: 'Kemampuan Belajar', weight: 0.15 },
            { key: 'score_komunikasi', label: 'Komunikasi', weight: 0.10 },
            { key: 'score_budaya', label: 'Kesesuaian Budaya', weight: 0.10 }
          ].map(dim => (
            <tr key={dim.key}>
              <td style={{ color: 'white', fontWeight: '500' }}>{dim.label}</td>
              <td>{dim.weight * 100}%</td>
              <td>
                <select 
                  className="score-select"
                  value={stageData[dim.key]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const nextState = { ...stageData, [dim.key]: val };
                    const weighted = calcHRDWeightedScore(nextState);
                    setStageData(p => ({ 
                      ...p, 
                      [dim.key]: val, 
                      total_weighted_score: weighted,
                      passed: weighted >= 3.5 ? 1 : 0
                    }));
                  }}
                >
                  <option value="1">1 (Tidak Memadai)</option>
                  <option value="2">2 (Kurang)</option>
                  <option value="3">3 (Cukup)</option>
                  <option value="4">4 (Baik)</option>
                  <option value="5">5 (Sangat Baik)</option>
                </select>
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>{(stageData[dim.key] * dim.weight).toFixed(2)}</td>
            </tr>
          ))}
          <tr style={{ background: 'var(--bg-hover)' }}>
            <td style={{ color: 'white', fontWeight: '700' }} colSpan="2">TOTAL SKOR TERBOBOT</td>
            <td colSpan="2" style={{ fontWeight: '800', color: 'var(--color-info)', fontSize: '16px' }}>
              {stageData.total_weighted_score}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="form-group form-group-full" style={{ marginBottom: '24px' }}>
        <label>Catatan Pertanyaan STAR & Rekomendasi HRD</label>
        <textarea 
          value={stageData.notes || ''}
          onChange={(e) => setStageData(p => ({ ...p, notes: e.target.value }))}
          placeholder="Ringkasan jawaban penting dari pelamar mengenai integritas dan penanganan keluhan..."
          rows={4}
        />
      </div>

      <div className={`checklist-item \${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Rekomendasikan ke Wawancara User (Kepala Toko)</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rekomendasi jika skor ≥ 3.5 (Direkomendasikan dengan catatan / kuat).</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary">Simpan Hasil Tahap 4</button>
      )}
    </form>
  );
}

export default Stage4HRD;
