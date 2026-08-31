import React, { useState, useEffect, useRef } from 'react';
import API_BASE from '../config';

function CandidateTest({ onExit }) {
  const [accessCode, setAccessCode] = useState('');
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Exam phase
  const [examStarted, setExamStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: selectedOption }
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes in seconds
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);

  const timerRef = useRef(null);

  const handleResetPortal = () => {
    setAccessCode('');
    setCandidateInfo(null);
    setIsValidated(false);
    setValidationError('');
    setExamStarted(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setTimeLeft(3600);
    setExamSubmitted(false);
    setSubmitting(false);
    setScoreResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
    // Clear query params so it doesn't auto-fill on refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleBackToDashboard = () => {
    const pin = window.prompt("Masukkan PIN HRD untuk kembali ke Dashboard Admin:");
    if (pin === "2512") {
      onExit();
    } else if (pin !== null) {
      alert("PIN salah! Akses ke Dashboard ditolak.");
    }
  };

  // Parse URL search parameters for automatic code input
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setAccessCode(codeParam.toUpperCase());
    }
  }, []);

  // Timer Effect
  useEffect(() => {
    if (examStarted && !examSubmitted) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            autoSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [examStarted, examSubmitted]);

  const handleValidateCode = async (e) => {
    if (e) e.preventDefault();
    if (!accessCode.trim()) return;

    try {
      setValidationError('');
      const res = await fetch(`${API_BASE}/test/validate/${accessCode.trim().toUpperCase()}`);
      const data = await res.json();

      if (data.isValid) {
        setCandidateInfo(data.candidate);
        setIsValidated(true);
        if (data.candidate.current_stage === 6) {
          setTimeLeft(1800); // 30 minutes for training
        } else {
          setTimeLeft(3600); // 60 minutes for written test
        }
      } else {
        setValidationError(data.message || 'Kode Akses tidak ditemukan.');
      }
    } catch (err) {
      console.error('Validation error:', err);
      setValidationError('Gagal menghubungi server.');
    }
  };

  const handleStartExam = async () => {
    try {
      setValidationError('');
      const res = await fetch(`${API_BASE}/test/questions/${accessCode.trim().toUpperCase()}`);
      const data = await res.json();

      if (data.success) {
        setQuestions(data.questions);
        setExamStarted(true);
      } else {
        setValidationError(data.message || 'Gagal memuat soal ujian.');
      }
    } catch (err) {
      console.error('Load questions error:', err);
      setValidationError('Kesalahan memuat soal.');
    }
  };

  const handleSelectOption = (questionId, option) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleSubmitExam = async () => {
    const totalQuestions = questions.length;
    const answeredCount = Object.keys(answers).length;

    if (answeredCount < totalQuestions) {
      const confirmSubmit = window.confirm(`Anda baru menjawab ${answeredCount} dari ${totalQuestions} soal. Apakah Anda yakin ingin menyelesaikan ujian sekarang?`);
      if (!confirmSubmit) return;
    } else {
      const confirmSubmit = window.confirm('Apakah Anda yakin ingin mengirimkan lembar jawaban sekarang?');
      if (!confirmSubmit) return;
    }

    submitAnswers();
  };

  const autoSubmitExam = () => {
    alert('Waktu ujian telah habis! Jawaban Anda akan dikirim secara otomatis.');
    submitAnswers();
  };

  const submitAnswers = async () => {
    try {
      setSubmitting(true);
      clearInterval(timerRef.current);

      const res = await fetch(`${API_BASE}/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: accessCode.trim().toUpperCase(),
          answers
        })
      });
      const data = await res.json();

      if (data.success) {
        setScoreResult(data.results);
        setExamSubmitted(true);
      } else {
        alert(data.message || 'Gagal mengirimkan jawaban.');
      }
    } catch (err) {
      console.error('Submit exam error:', err);
      alert('Kesalahan jaringan saat mengirim jawaban.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render 1: Enter Access Code Login Screen
  if (!isValidated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div className="sidebar-logo-icon" style={{ margin: '0 auto 16px auto', width: '48px', height: '48px', fontSize: '24px' }}>T</div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>Portal Ujian Online</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>Masukkan kode akses unik dari HRD untuk memulai ujian.</p>
          </div>

          <form onSubmit={handleValidateCode} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label>Kode Akses Kandidat</label>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Contoh: AZ8Y9P2K"
                maxLength={12}
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
              Verifikasi Kode Akses
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleBackToDashboard}>
              Kembali ke Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render 2: Validate success, show Briefing / Pre-exam Instructions
  if (isValidated && !examStarted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '40px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '8px' }}>Instruksi Pengerjaan Ujian</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Selamat datang, <strong style={{ color: 'white' }}>{candidateInfo.name}</strong>.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px', fontSize: '13px', lineHeight: '1.6' }}>
            <p><strong>Silakan baca ketentuan berikut sebelum memulai:</strong></p>
            {candidateInfo.current_stage === 6 ? (
              <ul style={{ paddingLeft: '20px' }}>
                <li>Durasi waktu pengerjaan adalah <strong>30 menit</strong>.</li>
                <li>Ujian terdiri dari evaluasi materi: <strong>Tes Pasca Training</strong>.</li>
                <li>Timer akan berjalan terus meskipun halaman ditutup.</li>
                <li>Passing grade untuk kelulusan tes training adalah <strong>≥ 65</strong>.</li>
                <li>Jangan melakukan refresh halaman atau menekan tombol back browser saat ujian sedang berlangsung.</li>
                <li>Jawaban akan otomatis dikirim saat timer mencapai angka nol (00:00).</li>
              </ul>
            ) : (
              <ul style={{ paddingLeft: '20px' }}>
                <li>Durasi waktu pengerjaan adalah <strong>60 menit</strong>.</li>
                <li>Ujian terdiri dari 4 bagian: <strong>Numerik & Kasir</strong>, <strong>Situasional Pelayanan</strong>, <strong>Pengetahuan Produk</strong>, dan <strong>Kepribadian</strong>.</li>
                <li>Timer akan berjalan terus meskipun halaman ditutup.</li>
                <li>Passing grade untuk tes kognitif (Numerik + Situasional + Produk) adalah <strong>≥ 65</strong>.</li>
                <li>Jangan melakukan refresh halaman atau menekan tombol back browser saat ujian sedang berlangsung.</li>
                <li>Jawaban akan otomatis dikirim saat timer mencapai angka nol (00:00).</li>
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setIsValidated(false)}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleStartExam}>
              Mulai Ujian Sekarang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render 3: Success Screen (Exam Submitted)
  if (examSubmitted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '550px', padding: '40px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-success-bg)', border: '2px solid var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <span style={{ color: 'var(--color-success)', fontSize: '32px', fontWeight: 'bold' }}>✓</span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'white', marginBottom: '12px' }}>Ujian Selesai Dikirimkan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px' }}>
            Terima kasih <strong style={{ color: 'white' }}>{candidateInfo.name}</strong>, lembar jawaban Anda telah sukses kami terima. Hasil ujian kognitif Anda akan otomatis diproses oleh sistem rekrutmen. Silakan hubungi tim HRD untuk tahapan seleksi berikutnya.
          </p>

          <button className="btn btn-secondary" style={{ margin: '0 auto' }} onClick={handleResetPortal}>
            Keluar Portal Ujian
          </button>
        </div>
      </div>
    );
  }

  // Render 4: Active Exam Workspace Screen
  const activeQuestion = questions[currentQuestionIndex];
  if (!activeQuestion) return <div className="loading-spinner"></div>;

  return (
    <div className="exam-layout">
      {/* Header */}
      <header className="exam-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sidebar-logo-icon" style={{ width: '32px', height: '32px', fontSize: '16px' }}>T</div>
          <div>
            <span style={{ fontWeight: '700', color: 'white', fontSize: '15px' }}>Ujian Online Frontliner</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '12px' }}>Kandidat: {candidateInfo.name}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="exam-timer">
            Sisa Waktu: {formatTime(timeLeft)}
          </div>
          <button className="btn btn-primary" onClick={handleSubmitExam} disabled={submitting}>
            {submitting ? 'Mengirim...' : 'Selesai & Kirim Ujian'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="exam-main">
        {/* Left sidebar: Question Navigator Map */}
        <aside className="glass-panel exam-questions-nav" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>Navigasi Soal</h3>
          <div className="questions-grid">
            {questions.map((q, idx) => {
              let btnClass = 'qn-btn';
              if (currentQuestionIndex === idx) {
                btnClass += ' active';
              } else if (answers[q.id] !== undefined) {
                btnClass += ' answered';
              }

              return (
                <button
                  key={q.id}
                  className={btnClass}
                  onClick={() => setCurrentQuestionIndex(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary)' }}></div>
              <span>Soal Aktif</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}></div>
              <span>Sudah Dijawab</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}></div>
              <span>Belum Dijawab</span>
            </div>
          </div>
        </aside>

        {/* Right content: Question card & Option selectors */}
        <section className="glass-panel exam-question-box">
          <div>
            <span className="badge badge-active" style={{ marginBottom: '16px' }}>
              Subtes: {activeQuestion.subtest.toUpperCase()} (Soal {currentQuestionIndex + 1} dari {questions.length})
            </span>
            <div className="exam-question-text">
              {activeQuestion.question_text}
            </div>
          </div>

          {/* Option Layout 1: Multiple Choice */}
          {activeQuestion.question_type === 'multiple-choice' && (
            <div className="exam-options-list">
              {[
                { letter: 'A', text: activeQuestion.option_a },
                { letter: 'B', text: activeQuestion.option_b },
                { letter: 'C', text: activeQuestion.option_c },
                { letter: 'D', text: activeQuestion.option_d }
              ].map(opt => (
                <div
                  key={opt.letter}
                  className={`option-card ${answers[activeQuestion.id] === opt.letter ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(activeQuestion.id, opt.letter)}
                >
                  <div className="option-letter">{opt.letter}</div>
                  <div style={{ fontSize: '14px', color: 'white' }}>{opt.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Option Layout 2: Likert Scale 1-5 */}
          {activeQuestion.question_type === 'likert' && (
            <div>
              <div className="likert-scale">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    key={val}
                    type="button"
                    className={`likert-btn ${answers[activeQuestion.id] === val ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(activeQuestion.id, val)}
                  >
                    <span className="likert-num">{val}</span>
                    <span className="likert-label">
                      {val === 1 ? 'Sangat Tidak Setuju' : val === 5 ? 'Sangat Setuju' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Option Layout 3: Forced Choice */}
          {activeQuestion.question_type === 'forced-choice' && (
            <div className="forced-choice-container">
              <div
                className={`forced-choice-card ${answers[activeQuestion.id] === 'P' ? 'selected' : ''}`}
                onClick={() => handleSelectOption(activeQuestion.id, 'P')}
              >
                <div className="forced-choice-letter">P</div>
                <div style={{ fontSize: '14px', color: 'white', lineHeight: '1.4' }}>{activeQuestion.option_p}</div>
              </div>
              <div
                className={`forced-choice-card ${answers[activeQuestion.id] === 'Q' ? 'selected' : ''}`}
                onClick={() => handleSelectOption(activeQuestion.id, 'Q')}
              >
                <div className="forced-choice-letter">Q</div>
                <div style={{ fontSize: '14px', color: 'white', lineHeight: '1.4' }}>{activeQuestion.option_q}</div>
              </div>
            </div>
          )}

          {/* Option Layout 4: Essay / Short Answer Input */}
          {activeQuestion.question_type === 'essay' && (
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Tuliskan Jawaban Anda:
              </label>
              <input
                type="text"
                className="input-custom"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  fontSize: '15px',
                  padding: '12px 16px',
                  borderRadius: '8px'
                }}
                placeholder="Ketik jawaban Anda di sini..."
                value={answers[activeQuestion.id] || ''}
                onChange={(e) => handleSelectOption(activeQuestion.id, e.target.value)}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                * Perhatikan ejaan, tanda baca, huruf besar/kecil, dan format penulisan.
              </p>
            </div>
          )}

          {/* Next/Prev control buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              ← Soal Sebelumnya
            </button>
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
              >
                Soal Berikutnya →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSubmitExam} disabled={submitting}>
                {submitting ? 'Mengirim...' : 'Selesai & Kirim'}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default CandidateTest;
