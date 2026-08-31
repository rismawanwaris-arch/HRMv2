import React from 'react';

function Stage2Written({ candidate, stageData, setStageData, handleStageSubmit, copyExamLink }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(2, stageData); }}>
      <div className="eval-title">
        <span>Tahap 2: Tes Tertulis (Online / Manual)</span>
        <span className={`badge \${stageData.passed ? 'badge-hired' : 'badge-active'}`}>
          {stageData.passed ? `Lolos (Skor: \${stageData.total_score})` : 'Menunggu Hasil'}
        </span>
      </div>

      <div className="access-code-box">
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>KODE AKSES UJIAN ONLINE KANDIDAT</div>
          <div className="access-code-val">{candidate.access_code}</div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={copyExamLink}>
          Salin Tautan Tes
        </button>
      </div>

      {stageData.test_completed_at ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div>
              <h4 style={{ color: 'white' }}>Ujian Selesai Dikerjakan Kandidat</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Waktu Selesai: {new Date(stageData.test_completed_at).toLocaleString('id-ID')}</p>
            </div>
            <div className={`score-badge-large \${stageData.passed ? 'passed' : 'failed'}`}>
              {stageData.total_score}
            </div>
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Hasil Rincian Sub-Tes Cognitive</h3>
          <div className="subtest-score-row">
            <div className="subtest-score-card">
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Numerik & Kasir</span>
              <span className="subtest-score-val" style={{ color: stageData.score_numerik >= 65 ? 'var(--color-success)' : 'var(--color-danger)' }}>{stageData.score_numerik}%</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Bobot: 30%</span>
            </div>
            <div className="subtest-score-card">
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Situasional Servis</span>
              <span className="subtest-score-val" style={{ color: stageData.score_situasional >= 65 ? 'var(--color-success)' : 'var(--color-danger)' }}>{stageData.score_situasional}%</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Bobot: 25%</span>
            </div>
            <div className="subtest-score-card">
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Produk & Teknologi</span>
              <span className="subtest-score-val" style={{ color: stageData.score_pengetahuan >= 65 ? 'var(--color-success)' : 'var(--color-danger)' }}>{stageData.score_pengetahuan}%</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Bobot: 25%</span>
            </div>
            <div className="subtest-score-card">
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Penulisan Nominal</span>
              <span className="subtest-score-val" style={{ color: stageData.score_nominal >= 65 ? 'var(--color-success)' : 'var(--color-danger)' }}>{stageData.score_nominal}%</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Bobot: 20%</span>
            </div>
          </div>

          {(() => {
            try {
              if (!stageData.cognitive_details) return null;
              const details = JSON.parse(stageData.cognitive_details);
              if (!details || details.length === 0) return null;
              
              return (
                <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#ef4444' }}>Daftar Jawaban Salah (Cognitive)</h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', background: 'rgba(239,68,68,0.02)' }}>
                    <table className="interview-scoring-table" style={{ margin: 0, width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Subtes</th>
                          <th>Pertanyaan</th>
                          <th>Jawaban Kandidat</th>
                          <th>Jawaban Benar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((d, idx) => (
                          <tr key={idx}>
                            <td style={{ textTransform: 'capitalize', fontSize: '12px', color: 'var(--text-muted)' }}>{d.subtest}</td>
                            <td style={{ fontSize: '13px' }}>{d.question_text}</td>
                            <td style={{ color: '#ef4444', fontWeight: '600' }}>{d.candidate_answer}</td>
                            <td style={{ color: '#10b981', fontWeight: '600' }}>{d.correct_answer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            } catch (e) {
              return null;
            }
          })()}

          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Hasil Kepribadian & Integritas (Dimensi Likert & Forced-Choice)</h3>
          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <table className="interview-scoring-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Aspek / Dimensi</th>
                  <th>Hasil Jawaban Kandidat</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  try {
                    const traits = JSON.parse(stageData.score_kepribadian);
                    if (!traits || traits.length === 0) return <tr><td colSpan="2">Tidak ada data kepribadian.</td></tr>;
                    return traits.map((t, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{t.dimension}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tipe: {t.type}</div>
                        </td>
                        <td style={{ fontWeight: '600', color: 'white' }}>
                          {t.type === 'likert' ? `Poin Rating: \${t.answer} / 5` : `Pilihan: Opsi \${t.answer}`}
                        </td>
                      </tr>
                    ));
                  } catch (e) {
                    return <tr><td colSpan="2">Format data kepribadian tidak valid.</td></tr>;
                  }
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', marginBottom: '32px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Kandidat belum mengerjakan ujian online.</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Anda juga dapat menginputkan hasil secara manual jika ujian dilakukan dengan kertas/offline.</p>
          </div>

          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Input Hasil Manual (Offline)</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Skor Numerik & Kasir (0 - 100)</label>
              <input 
                type="number" 
                value={stageData.score_numerik}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const avg = Math.round((val + stageData.score_situasional + stageData.score_pengetahuan + stageData.score_nominal) / 4);
                  setStageData(p => ({ ...p, score_numerik: val, total_score: avg, passed: avg >= 65 ? 1 : 0 }));
                }}
                min="0" max="100"
              />
            </div>
            <div className="form-group">
              <label>Skor Situasional Pelayanan (0 - 100)</label>
              <input 
                type="number" 
                value={stageData.score_situasional}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const avg = Math.round((stageData.score_numerik + val + stageData.score_pengetahuan + stageData.score_nominal) / 4);
                  setStageData(p => ({ ...p, score_situasional: val, total_score: avg, passed: avg >= 65 ? 1 : 0 }));
                }}
                min="0" max="100"
              />
            </div>
            <div className="form-group">
              <label>Skor Produk & Teknologi (0 - 100)</label>
              <input 
                type="number" 
                value={stageData.score_pengetahuan}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const avg = Math.round((stageData.score_numerik + stageData.score_situasional + val + stageData.score_nominal) / 4);
                  setStageData(p => ({ ...p, score_pengetahuan: val, total_score: avg, passed: avg >= 65 ? 1 : 0 }));
                }}
                min="0" max="100"
              />
            </div>
            <div className="form-group">
              <label>Skor Penulisan Nominal (0 - 100)</label>
              <input 
                type="number" 
                value={stageData.score_nominal}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const avg = Math.round((stageData.score_numerik + stageData.score_situasional + stageData.score_pengetahuan + val) / 4);
                  setStageData(p => ({ ...p, score_nominal: val, total_score: avg, passed: avg >= 65 ? 1 : 0 }));
                }}
                min="0" max="100"
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Skor Rata-rata Akhir (Auto-graded)</label>
              <input type="number" value={stageData.total_score} readOnly style={{ background: 'var(--bg-hover)', border: 'none' }} />
            </div>
          </div>

          <div className={`checklist-item \${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginTop: '24px', marginBottom: '24px' }}
               onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
            <div className="checkbox-custom"></div>
            <div className="checklist-label">
              <strong>Nyatakan Lolos Tes Tertulis (Passing Grade ≥ 65)</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Centang manual untuk mengabaikan atau menyetujui hasil kelulusan.</div>
            </div>
          </div>
        </div>
      )}

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary" style={{ marginTop: '24px' }}>Simpan Hasil Tahap 2</button>
      )}
    </form>
  );
}

export default Stage2Written;
