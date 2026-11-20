import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { adminTrainingApi } from '../services/api';

function TrainingQuestionBank({ currentRole }) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState(null);
  const [statementText, setStatementText] = useState('');

  useEffect(() => {
    fetchStatements();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminTrainingApi.getQuestions();
      if (data.success) {
        setStatements(data.questions || []);
      } else {
        setError(data.message || 'Gagal memuat bank pernyataan training.');
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat bank pernyataan training.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingStatement(null);
    setStatementText('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (stmt) => {
    setEditingStatement(stmt);
    setStatementText(stmt.statement_text);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!statementText.trim()) {
      alert('Pernyataan evaluasi wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { statement_text: statementText.trim() };
      const data = editingStatement
        ? await adminTrainingApi.updateQuestion(editingStatement.id, payload)
        : await adminTrainingApi.addQuestion(payload);

      if (data.success) {
        alert(editingStatement ? 'Pernyataan berhasil diperbarui!' : 'Pernyataan baru berhasil ditambahkan!');
        setIsModalOpen(false);
        fetchStatements();
      } else {
        alert(data.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      alert(err.message || 'Koneksi server gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStatement = async (id, text) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus pernyataan: \n"${text}"?`)) {
      return;
    }

    try {
      const data = await adminTrainingApi.deleteQuestion(id);
      if (data.success) {
        fetchStatements();
      } else {
        alert(data.message || 'Gagal menghapus data.');
      }
    } catch (err) {
      alert(err.message || 'Kesalahan jaringan.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Soal & Pernyataan Training</h1>
          <p className="page-subtitle">Kelola indikator checklist penilaian 1-10 untuk evaluasi praktek kerja pasca training.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tambah Indikator Baru
        </button>
      </div>

      {/* List Container */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading ? (
          <div className="loading-spinner"></div>
        ) : error ? (
          <div style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '20px' }}>
            <p style={{ marginBottom: '12px' }}>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={fetchStatements}>Coba Lagi</button>
          </div>
        ) : statements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            Belum ada pernyataan penilaian training. Klik "Tambah Indikator Baru" untuk memulai.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>No.</th>
                  <th>Pernyataan Kompetensi Training (Skala Penilaian 1-10)</th>
                  <th style={{ width: '200px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((stmt, idx) => (
                  <tr key={stmt.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '15px' }}>
                      "{stmt.statement_text}"
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleOpenEditModal(stmt)}
                        >
                          Edit
                        </button>
                        {currentRole === 'master' && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                            onClick={() => handleDeleteStatement(stmt.id, stmt.statement_text)}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && createPortal(
        <div
          className="modal-overlay"
          style={{ zIndex: 3000, overscrollBehavior: 'contain' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            className="glass-panel modal-content"
            style={{ maxWidth: '500px', background: 'var(--bg-surface-opaque)', overscrollBehavior: 'contain' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{editingStatement ? 'Edit Indikator Training' : 'Tambah Indikator Training Baru'}</h2>
              <button type="button" className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
              <div className="form-group form-group-full">
                <label>Teks Pernyataan Kompetensi</label>
                <textarea
                  value={statementText}
                  onChange={(e) => setStatementText(e.target.value)}
                  placeholder="Contoh: Karyawan mampu melayani transaksi pembelian pulsa dengan cepat dan ramah..."
                  rows={4}
                  style={{ width: '100%' }}
                  required
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                  Pernyataan ini akan dinilai oleh Supervisor/Trainer dengan skor dari 1 hingga 10 pada portal training.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : editingStatement ? 'Simpan Perubahan' : 'Tambah Indikator'}
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

export default TrainingQuestionBank;
