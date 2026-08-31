import React, { useState, useEffect } from 'react';
import API_BASE from '../config';

function TrainingTestPortal({ onExit }) {
  const [accessCode, setAccessCode] = useState('');
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [statements, setStatements] = useState([]);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Ratings state: { statementId: ratingVal } (ratingVal between 1 and 10)
  const [ratings, setRatings] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [evalResult, setEvalResult] = useState(null);

  const handleResetPortal = () => {
    setAccessCode('');
    setCandidateInfo(null);
    setStatements([]);
    setIsValidated(false);
    setValidationError('');
    setRatings({});
    setNotes('');
    setSubmitting(false);
    setSubmitted(false);
    setEvalResult(null);
  };

  const handleValidateCode = async (e) => {
    if (e) e.preventDefault();
    if (!accessCode.trim()) return;

    try {
      setValidationError('');
      const res = await fetch(`${API_BASE}/training-test/validate/${accessCode.trim().toUpperCase()}`);
      const data = await res.json();

      if (data.isValid) {
        setCandidateInfo(data.candidate);
        setStatements(data.statements);
        // Initialize ratings with default value of 7 for each statement
        const initialRatings = {};
        data.statements.forEach(stmt => {
          initialRatings[stmt.id] = 7;
        });
        setRatings(initialRatings);
        setIsValidated(true);
      } else {
        setValidationError(data.message || 'Kode Akses salah atau tidak valid.');
      }
    } catch (err) {
      console.error('Validation error:', err);
      setValidationError('Gagal menghubungi server.');
    }
  };

  const handleRate = (stmtId, score) => {
    setRatings(prev => ({
      ...prev,
      [stmtId]: score
    }));
  };

  // Live average calculation
  const calculateAverage = () => {
    const vals = Object.values(ratings);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return parseFloat((sum / vals.length).toFixed(2));
  };

  const handleSubmitEvaluation = async () => {
    const unanswered = statements.some(stmt => !ratings[stmt.id]);
    if (unanswered) {
      alert('Mohon isi semua penilaian kompetensi karyawan!');
      return;
    }

    if (!window.confirm('Apakah Anda yakin ingin mengirimkan hasil evaluasi training ini?')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/training-test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: accessCode.trim().toUpperCase(),
          ratings,
          notes
        })
      });
      const data = await res.json();

      if (data.success) {
        setEvalResult(data.results);
        setSubmitted(true);
      } else {
        alert(data.message || 'Gagal mengirimkan penilaian.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Koneksi internet terputus saat mengirim.');
    } finally {
      setSubmitting(false);
    }
  };

  // Render 1: Enter Access Code Login Screen
  if (!isValidated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div className="sidebar-logo-icon" style={{ margin: '0 auto 16px auto', width: '48px', height: '48px', fontSize: '24px', background: 'var(--color-primary)' }}>T</div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>Portal Evaluasi Training</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>Masukkan kode akses unik kandidat (Tahap 6) untuk menguji kecakapan praktek.</p>
          </div>

          <form onSubmit={handleValidateCode} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label>Kode Akses Kandidat (6 Karakter)</label>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Contoh: AZ8Y9P"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}
                required
              />
            </div>

            {validationError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '13px', textAlign: 'center', background: 'var(--color-danger-bg)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {validationError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center' }}>
              Mulai Penilaian Kompetensi
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onExit}>
              Kembali ke Dashboard Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render 2: Success Submission Screen
  if (submitted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '550px', padding: '40px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-success-bg)', border: '2px solid var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <span style={{ color: 'var(--color-success)', fontSize: '32px', fontWeight: 'bold' }}>✓</span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '12px' }}>Evaluasi Sukses Disimpan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            Lembar penilaian training untuk kandidat <strong style={{ color: 'white' }}>{candidateInfo.name}</strong> telah berhasil direkam.
          </p>

          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Skor Rata-rata Training:</span>
              <strong style={{ color: 'white', fontSize: '16px' }}>{evalResult?.averageScore} / 10</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Keputusan Kelulusan:</span>
              <span className={`badge ${evalResult?.passed ? 'badge-hired' : 'badge-failed'}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                {evalResult?.passed ? 'LOLOS (Lanjut Offering)' : 'GUGUR'}
              </span>
            </div>
          </div>

          <button className="btn btn-secondary" style={{ margin: '0 auto' }} onClick={handleResetPortal}>
            Kembali ke Halaman Utama Portal
          </button>
        </div>
      </div>
    );
  }

  // Render 3: Active Statement Grading Screen
  const avg = calculateAverage();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Sticky Header */}
      <header className="exam-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sidebar-logo-icon" style={{ width: '32px', height: '32px', fontSize: '16px', background: 'var(--color-primary)' }}>T</div>
          <div>
            <span style={{ fontWeight: '700', color: 'white', fontSize: '15px' }}>Evaluasi Kompetensi Kerja Pasca Training</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '12px' }}>Kandidat: {candidateInfo.name}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Nilai Rata-rata: <strong style={{ color: 'white', fontSize: '18px' }}>{avg}</strong> / 10
          </div>
          <button className="btn btn-primary" onClick={handleSubmitEvaluation} disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Kirim & Simpan Evaluasi'}
          </button>
        </div>
      </header>

      {/* Main Form workspace */}
      <main style={{ flexGrow: 1, padding: '40px 20px', maxWidth: '850px', width: '100%', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '30px', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'white', marginBottom: '10px' }}>Instruksi Pengisian Evaluasi</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
            Berikan nilai kecakapan kandidat pada setiap indikator di bawah berdasarkan praktek lapangan training konter. 
            Skala nilai berkisar antara <strong>1 (Sangat Buruk)</strong> hingga <strong>10 (Sempurna)</strong>. 
            Standar rata-rata kelulusan minimal training konter adalah <strong>≥ 6.5</strong>.
          </p>
        </div>

        {/* Statements list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {statements.map((stmt, idx) => (
            <div key={stmt.id} className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                INDIKATOR {idx + 1}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'white', marginBottom: '20px', lineHeight: '1.5' }}>
                "{stmt.statement_text}"
              </h3>

              {/* 1-10 Selector Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', overflowX: 'auto', paddingBottom: '8px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                  const isSelected = ratings[stmt.id] === score;
                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() => handleRate(stmt.id, score)}
                      style={{
                        flex: '1',
                        minWidth: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.01)',
                        color: isSelected ? 'white' : 'var(--text-secondary)',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', padding: '0 4px' }}>
                <span>1 = Sangat Kurang</span>
                <span>5 = Cukup</span>
                <span>10 = Sempurna</span>
              </div>
            </div>
          ))}
        </div>

        {/* Evaluator Notes */}
        <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
          <div className="form-group form-group-full">
            <label style={{ color: 'white', fontWeight: '600', marginBottom: '10px' }}>Catatan & Evaluasi Praktek Karyawan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Berikan umpan balik atau deskripsi detail kelemahan dan kelebihan praktek kerja kandidat selama training di gerai..."
              rows={4}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Bottom submit indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <button className="btn btn-secondary" onClick={handleResetPortal}>
            Batal
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Skor Akhir: <strong style={{ color: 'white' }}>{avg} / 10</strong>
            </span>
            <button className="btn btn-primary" onClick={handleSubmitEvaluation} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Kirim & Luluskan'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TrainingTestPortal;
