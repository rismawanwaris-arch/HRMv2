import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { adminTestApi } from '../services/api';

function QuestionBank({ currentRole }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Category tabs
  const [activeTab, setActiveTab] = useState('numerik');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    subtest: 'numerik',
    question_type: 'multiple-choice',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    dimension: '',
    option_p: '',
    option_q: ''
  });

  const categoryLabels = {
    numerik: 'Numerik & Kasir',
    situasional: 'Situasional Pelayanan',
    produk: 'Pengetahuan Produk & Tek',
    nominal: 'Penulisan Nominal',
    kepribadian: 'Kepribadian & Integritas'
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminTestApi.getQuestions();
      if (data.success) {
        setQuestions(data.questions || []);
      } else {
        setError(data.message || 'Gagal memuat bank soal.');
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat bank soal.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'subtest') {
      setFormData(prev => {
        const nextType = value === 'kepribadian'
          ? (['likert', 'forced-choice'].includes(prev.question_type) ? prev.question_type : 'likert')
          : (['multiple-choice', 'essay'].includes(prev.question_type) ? prev.question_type : 'multiple-choice');
        return { ...prev, subtest: value, question_type: nextType };
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenAddModal = () => {
    setEditingQuestion(null);
    setFormData({
      subtest: activeTab,
      question_type: activeTab === 'kepribadian' ? 'likert' : 'multiple-choice',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      dimension: '',
      option_p: '',
      option_q: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    setFormData({
      subtest: q.subtest,
      question_type: q.question_type,
      question_text: q.question_text,
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_option: q.correct_option || 'A',
      dimension: q.dimension || '',
      option_p: q.option_p || '',
      option_q: q.option_q || ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formData.question_text.trim()) {
      alert('Teks soal wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      const data = editingQuestion
        ? await adminTestApi.updateQuestion(editingQuestion.id, formData)
        : await adminTestApi.addQuestion(formData);

      if (data.success) {
        alert(editingQuestion ? 'Soal berhasil diperbarui.' : 'Soal baru berhasil disimpan.');
        setIsModalOpen(false);
        fetchQuestions();
      } else {
        alert(data.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan koneksi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Apakah Anda yakin ingin menghapus soal ini dari bank soal?')) {
      return;
    }

    try {
      const data = await adminTestApi.deleteQuestion(id);
      if (data.success) {
        fetchQuestions();
      } else {
        alert(data.message || 'Gagal menghapus soal.');
      }
    } catch (err) {
      alert(err.message || 'Koneksi gagal.');
    }
  };

  const getFilteredQuestions = () => {
    return questions.filter(q => q.subtest === activeTab);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Bank Soal</h1>
          <p className="page-subtitle">Kelola instrumen soal ujian online untuk penyeleksian kandidat.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tambah Soal Baru
        </button>
      </div>

      {/* Category Tabs Menu */}
      <div className="tab-menu" style={{ marginBottom: '24px' }}>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
            style={{ fontSize: '14px', padding: '12px 20px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List of active category questions */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading ? (
          <div className="loading-spinner"></div>
        ) : error ? (
          <div style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '20px' }}>
            <p style={{ marginBottom: '12px' }}>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={fetchQuestions}>Coba Lagi</button>
          </div>
        ) : getFilteredQuestions().length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Belum ada soal pada kategori ini. Klik "Tambah Soal Baru" di atas untuk menambahkan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {getFilteredQuestions().map((q, idx) => (
              <div
                key={q.id}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  position: 'relative'
                }}
              >
                {/* Header card info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="badge badge-active" style={{ fontSize: '10px' }}>
                    No. {idx + 1} | ID: {q.id}
                  </span>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: '4px' }}>
                      Tipe: {(q.question_type || '-').toUpperCase()}
                    </span>
                    {q.dimension && (
                      <span style={{ fontSize: '11px', color: 'var(--secondary)', background: 'rgba(147, 51, 234, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                        Dimensi: {q.dimension}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '16px', lineHeight: '1.5' }}>
                  {q.question_text}
                </div>

                {/* Options display */}
                {q.question_type === 'multiple-choice' && (
                  <div className="responsive-grid-2" style={{ gap: '10px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: q.correct_option === 'A' ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                      <strong>A.</strong> {q.option_a} {q.correct_option === 'A' && '✓'}
                    </div>
                    <div style={{ fontSize: '13px', color: q.correct_option === 'B' ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                      <strong>B.</strong> {q.option_b} {q.correct_option === 'B' && '✓'}
                    </div>
                    <div style={{ fontSize: '13px', color: q.correct_option === 'C' ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                      <strong>C.</strong> {q.option_c} {q.correct_option === 'C' && '✓'}
                    </div>
                    <div style={{ fontSize: '13px', color: q.correct_option === 'D' ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                      <strong>D.</strong> {q.option_d} {q.correct_option === 'D' && '✓'}
                    </div>
                  </div>
                )}

                {q.question_type === 'forced-choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <strong>Opsi P:</strong> {q.option_p}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <strong>Opsi Q:</strong> {q.option_q}
                    </div>
                  </div>
                )}

                {q.question_type === 'likert' && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    * Menampilkan rating skala 1 s.d. 5 (Sangat Tidak Setuju s.d. Sangat Setuju)
                  </div>
                )}

                {q.question_type === 'essay' && (
                  <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-success)' }}>
                      <strong>Kunci Jawaban Isian:</strong> {q.correct_option}
                    </div>
                  </div>
                )}

                {/* Actions bottom alignment */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => handleOpenEditModal(q)}
                  >
                    Edit Soal
                  </button>
                  {currentRole === 'master' && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                      onClick={(e) => handleDeleteQuestion(q.id, e)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {isModalOpen && createPortal(
        <div
          className="modal-overlay"
          style={{ zIndex: 3000, overscrollBehavior: 'contain' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            className="glass-panel modal-content"
            style={{ maxWidth: '650px', background: 'var(--bg-surface-opaque)', overscrollBehavior: 'contain' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{editingQuestion ? 'Edit Soal Ujian' : 'Tambah Soal Ujian Baru'}</h2>
              <button type="button" className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleFormSubmit} className="form-grid">
              <div className="form-group">
                <label>Kategori Sub-tes</label>
                <select name="subtest" value={formData.subtest} onChange={handleInputChange}>
                  <option value="numerik">Numerik & Kasir</option>
                  <option value="situasional">Situasional Pelayanan</option>
                  <option value="produk">Pengetahuan Produk & Teknologi</option>
                  <option value="nominal">Penulisan Nominal</option>
                  <option value="kepribadian">Kepribadian & Integritas</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tipe Pertanyaan</label>
                <select name="question_type" value={formData.question_type} onChange={handleInputChange}>
                  {formData.subtest === 'kepribadian' ? (
                    <>
                      <option value="likert">Skala Likert (1-5)</option>
                      <option value="forced-choice">Forced-Choice (P/Q)</option>
                    </>
                  ) : (
                    <>
                      <option value="multiple-choice">Pilihan Ganda (A, B, C, D)</option>
                      <option value="essay">Isian Singkat (Esai)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group form-group-full">
                <label>Teks Soal / Pertanyaan *</label>
                <textarea
                  name="question_text"
                  value={formData.question_text}
                  onChange={handleInputChange}
                  placeholder="Masukkan kalimat pertanyaan atau pernyataan soal..."
                  rows={3}
                  required
                />
              </div>

              {/* Fields for Multiple Choice */}
              {formData.question_type === 'multiple-choice' && (
                <>
                  <div className="form-group">
                    <label>Pilihan Opsi A *</label>
                    <input type="text" name="option_a" value={formData.option_a} onChange={handleInputChange} placeholder="Teks opsi A..." required />
                  </div>
                  <div className="form-group">
                    <label>Pilihan Opsi B *</label>
                    <input type="text" name="option_b" value={formData.option_b} onChange={handleInputChange} placeholder="Teks opsi B..." required />
                  </div>
                  <div className="form-group">
                    <label>Pilihan Opsi C *</label>
                    <input type="text" name="option_c" value={formData.option_c} onChange={handleInputChange} placeholder="Teks opsi C..." required />
                  </div>
                  <div className="form-group">
                    <label>Pilihan Opsi D *</label>
                    <input type="text" name="option_d" value={formData.option_d} onChange={handleInputChange} placeholder="Teks opsi D..." required />
                  </div>
                  <div className="form-group">
                    <label>Kunci Jawaban Benar</label>
                    <select name="correct_option" value={formData.correct_option} onChange={handleInputChange}>
                      <option value="A">Opsi A</option>
                      <option value="B">Opsi B</option>
                      <option value="C">Opsi C</option>
                      <option value="D">Opsi D</option>
                    </select>
                  </div>
                </>
              )}

              {/* Fields for Essay */}
              {formData.question_type === 'essay' && (
                <div className="form-group form-group-full">
                  <label>Kunci Jawaban Benar (Isian Singkat) *</label>
                  <input
                    type="text"
                    name="correct_option"
                    value={formData.correct_option}
                    onChange={handleInputChange}
                    placeholder="Contoh: Rp. 1.550.000"
                    required
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    * Jawaban kandidat akan dianggap BENAR jika cocok (tidak sensitif huruf kapital dan spasi berlebih).
                  </div>
                </div>
              )}

              {/* Fields for Forced Choice */}
              {formData.question_type === 'forced-choice' && (
                <>
                  <div className="form-group form-group-full">
                    <label>Pernyataan P *</label>
                    <input type="text" name="option_p" value={formData.option_p} onChange={handleInputChange} placeholder="Teks pernyataan P..." required />
                  </div>
                  <div className="form-group form-group-full">
                    <label>Pernyataan Q *</label>
                    <input type="text" name="option_q" value={formData.option_q} onChange={handleInputChange} placeholder="Teks pernyataan Q..." required />
                  </div>
                  <div className="form-group">
                    <label>Dimensi Kepribadian (Aspek yang Diukur)</label>
                    <input type="text" name="dimension" value={formData.dimension} onChange={handleInputChange} placeholder="Contoh: Kejujuran, Disiplin..." />
                  </div>
                </>
              )}

              {/* Fields for Likert Scale */}
              {formData.question_type === 'likert' && (
                <div className="form-group">
                  <label>Dimensi Kepribadian (Aspek yang Diukur)</label>
                  <input type="text" name="dimension" value={formData.dimension} onChange={handleInputChange} placeholder="Contoh: Disiplin, Kontrol Diri..." />
                </div>
              )}

              {/* Form submit/cancel buttons */}
              <div className="form-group-full" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Menyimpan...' : editingQuestion ? 'Perbarui Soal' : 'Simpan Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default QuestionBank;
