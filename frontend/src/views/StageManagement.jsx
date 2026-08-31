import React, { useState, useEffect } from 'react';
import { stageApi } from '../services/api';

function StageManagement({ setView }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      const res = await stageApi.getAll();
      if (res.success) {
        setStages(res.data);
      }
    } catch (err) {
      console.error('Error fetching stages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Nama tahap seleksi wajib diisi.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await stageApi.create({ name: form.name });
      if (res.success) {
        setStages(prev => [...prev, res.data]);
        setShowAddModal(false);
        setForm({ name: '' });
      } else {
        setError(res.message || 'Gagal menambahkan tahap.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editForm.name.trim()) {
      setError('Nama tahap seleksi wajib diisi.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await stageApi.update(editForm.id, { name: editForm.name });
      if (res.success) {
        setStages(prev => prev.map(s => s.id === editForm.id ? { ...s, name: editForm.name } : s));
        setShowEditModal(false);
      } else {
        setError(res.message || 'Gagal memperbarui tahap.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (stage) => {
    if (!window.confirm(`Hapus tahap seleksi "${stage.name}"?\nSemua data evaluasi generic/custom untuk tahap ini juga akan dihapus.`)) return;
    try {
      const res = await stageApi.delete(stage.id);
      if (res.success) {
        setStages(prev => prev.filter(s => s.id !== stage.id));
      } else {
        alert(res.message || 'Gagal menghapus tahap seleksi.');
      }
    } catch (err) {
      alert('Gagal terhubung ke server.');
    }
  };

  const handleToggleActive = async (stage) => {
    try {
      const nextActive = stage.is_active ? 0 : 1;
      const res = await stageApi.update(stage.id, { is_active: nextActive });
      if (res.success) {
        setStages(prev => prev.map(s => s.id === stage.id ? { ...s, is_active: nextActive } : s));
      }
    } catch (err) {
      alert('Gagal mengubah status aktif.');
    }
  };

  const handleMove = async (index, direction) => {
    const updated = [...stages];
    if (direction === 'up' && index > 0) {
      [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
    } else if (direction === 'down' && index < updated.length - 1) {
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    } else {
      return;
    }
    setStages(updated);
    try {
      await stageApi.reorder(updated.map(s => s.id));
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan urutan baru.');
      fetchStages(); // Rollback
    }
  };

  const builtInCodes = ['admin', 'written', 'simulation', 'interview_hrd', 'interview_user', 'mcu_ref', 'offering'];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan Pipeline Seleksi</h1>
          <p className="page-subtitle">Sesuaikan alur proses rekrutmen perusahaan Anda.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowAddModal(true); setError(''); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Tahap Baru
        </button>
      </div>

      {/* Info Card */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>⚙️</div>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', color: 'white' }}>Panduan Pipeline Seleksi</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Tahap bawaan sistem (System Built-in) memiliki form penilaian khusus. Tahap kustom/tambahan akan menggunakan form evaluasi generic. Anda dapat menonaktifkan tahap bawaan jika tidak diperlukan di perusahaan Anda.
          </p>
        </div>
      </div>

      {/* Stages Table */}
      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            Memuat alur pipeline...
          </div>
        ) : stages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Belum ada tahap seleksi</p>
            <p style={{ fontSize: '13px' }}>Klik <strong>"Tambah Tahap Baru"</strong> untuk mendaftarkan proses seleksi.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Urutan</th>
                  <th>Nama Tahap Seleksi</th>
                  <th>Tipe Tahap</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '220px' }}>Ubah Posisi</th>
                  <th style={{ textAlign: 'center', width: '240px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, idx) => {
                  const isBuiltIn = builtInCodes.includes(stage.code);
                  return (
                    <tr key={stage.id} style={{ opacity: stage.is_active ? 1 : 0.55 }}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage.name}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: isBuiltIn ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                          color: isBuiltIn ? 'var(--color-primary)' : '#f59e0b',
                          textTransform: 'uppercase'
                        }}>
                          {isBuiltIn ? 'Sistem (Built-in)' : 'Kustom'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(stage)}
                          style={{
                            background: stage.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: stage.is_active ? 'var(--color-success)' : 'var(--color-danger)',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {stage.is_active ? '● Aktif' : '○ Nonaktif'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px', minWidth: '40px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                            title="Pindah ke Atas"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === stages.length - 1}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px', minWidth: '40px', cursor: idx === stages.length - 1 ? 'not-allowed' : 'pointer' }}
                            title="Pindah ke Bawah"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditForm({ id: stage.id, name: stage.name });
                              setShowEditModal(true);
                              setError('');
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '6px 12px',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ✏️ Edit Nama
                          </button>
                          {!isBuiltIn && (
                            <button
                              onClick={() => handleDelete(stage)}
                              style={{
                                background: 'rgba(239,68,68,0.12)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                color: '#ef4444',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
                              onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
                            >
                              🗑️ Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Stage Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '420px',
            background: 'linear-gradient(160deg, rgba(15,15,30,0.98) 0%, rgba(20,12,40,0.98) 100%)',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>Tambah Tahap Seleksi Baru</h3>
              <button
                onClick={() => { setShowAddModal(false); setError(''); setForm({ name: '' }); }}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '20px' }}
              >×</button>
            </div>

            {error && (
              <div style={{ margin: '16px 28px 0', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleAdd} style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Nama Tahap *</label>
                <input
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
                  placeholder="Contoh: Tes Wawancara Psikolog"
                  value={form.name}
                  onChange={e => setForm({ name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setError(''); setForm({ name: '' }); }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px 0' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '10px 0' }}
                >
                  {submitting ? 'Menyimpan...' : 'Tambah Tahap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stage Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '420px',
            background: 'linear-gradient(160deg, rgba(15,15,30,0.98) 0%, rgba(20,12,40,0.98) 100%)',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>Ubah Nama Tahap Seleksi</h3>
              <button
                onClick={() => { setShowEditModal(false); setError(''); }}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '20px' }}
              >×</button>
            </div>

            {error && (
              <div style={{ margin: '16px 28px 0', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Nama Tahap *</label>
                <input
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px 0' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '10px 0' }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StageManagement;
