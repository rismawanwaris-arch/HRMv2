import React, { useState, useEffect } from 'react';
import API_BASE from '../config';

function BranchManagement({ setView }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', address: '', city: '' });
  const [editForm, setEditForm] = useState({ id: null, code: '', name: '', address: '', city: '', status: 'Active' });
  const [error, setError] = useState('');

  useEffect(() => { fetchBranches(); }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) setBranches(data.data);
    } catch (err) {
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.code.trim() || !form.name.trim()) {
      setError('Kode Cabang dan Nama Cabang wajib diisi.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setBranches(prev => [...prev, data.data].sort((a, b) => a.name.localeCompare(b.name)));
        setShowAddModal(false);
        setForm({ code: '', name: '', address: '', city: '' });
      } else {
        setError(data.message || 'Gagal menambahkan cabang.');
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
    if (!editForm.code.trim() || !editForm.name.trim()) {
      setError('Kode Cabang dan Nama Cabang wajib diisi.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/branches/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        setBranches(prev => prev.map(b => b.id === editForm.id ? data.data : b).sort((a, b) => a.name.localeCompare(b.name)));
        setShowEditModal(false);
      } else {
        setError(data.message || 'Gagal memperbarui cabang.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (branch) => {
    if (!window.confirm(`Hapus cabang "${branch.name}"?\n\nKaryawan yang terdaftar di cabang ini akan menjadi tidak memiliki cabang.`)) return;
    try {
      const res = await fetch(`${API_BASE}/branches/${branch.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBranches(prev => prev.filter(b => b.id !== branch.id));
      } else {
        alert(data.message || 'Gagal menghapus cabang.');
      }
    } catch (err) {
      alert('Gagal terhubung ke server.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Cabang Outlet</h1>
          <p className="page-subtitle">Kelola daftar cabang dan outlet perusahaan.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowAddModal(true); setError(''); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Cabang
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
          <div className="stat-card-title">Total Cabang</div>
          <div className="stat-card-value" style={{ color: 'var(--color-primary)' }}>{branches.length}</div>
          <div className="stat-card-desc">Cabang terdaftar</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="stat-card-title">Status Aktif</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {branches.filter(b => b.status === 'Active').length}
          </div>
          <div className="stat-card-desc">Cabang beroperasi</div>
        </div>
      </div>

      {/* Branches Table */}
      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            Memuat data cabang...
          </div>
        ) : branches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Belum ada cabang terdaftar</p>
            <p style={{ fontSize: '13px' }}>Klik <strong>"Tambah Cabang"</strong> untuk menambahkan cabang pertama.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Kota</th>
                  <th>Alamat</th>
                  <th>Status</th>
                  <th>Terdaftar</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(branch => (
                  <tr key={branch.id}>
                    <td>
                      <span style={{
                        background: 'rgba(139,92,246,0.15)',
                        color: 'var(--color-primary)',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '13px',
                        letterSpacing: '0.5px'
                      }}>
                        {branch.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{branch.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{branch.city || '-'}</td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {branch.address || '-'}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: branch.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                        color: branch.status === 'Active' ? 'var(--color-success)' : 'var(--text-muted)'
                      }}>
                        {branch.status === 'Active' ? '● Aktif' : '● Nonaktif'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {new Date(branch.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setEditForm({
                            id: branch.id,
                            code: branch.code,
                            name: branch.name,
                            address: branch.address || '',
                            city: branch.city || '',
                            status: branch.status || 'Active'
                          });
                          setShowEditModal(true);
                          setError('');
                        }}
                        style={{
                          background: 'rgba(59,130,246,0.12)',
                          border: '1px solid rgba(59,130,246,0.25)',
                          color: '#3b82f6',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginRight: '8px'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(59,130,246,0.22)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(branch)}
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#ef4444',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Branch Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '460px',
            background: 'var(--bg-surface-opaque)',
            border: '1px solid var(--border-color)', borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Tambah Cabang Baru</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Daftarkan cabang atau outlet baru</p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setError(''); setForm({ code: '', name: '', address: '', city: '' }); }}
                style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#f87171', fontSize: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAdd} style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{ width: '3px', height: '18px', background: '#8b5cf6', borderRadius: '2px' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6' }}>Informasi Cabang</span>
              </div>

              {/* Kode Cabang */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kode Cabang <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase', transition: 'border-color 0.2s' }}
                  placeholder="Contoh: JKT-01, BGR-02"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              {/* Nama Cabang */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nama Cabang <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  placeholder="Contoh: Cabang Sudirman"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              {/* Kota */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kota
                </label>
                <input
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  placeholder="Contoh: Jakarta"
                  value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                />
              </div>

              {/* Alamat */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Alamat Lengkap
                </label>
                <textarea
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: '90px', transition: 'border-color 0.2s' }}
                  placeholder="Masukkan alamat lengkap cabang..."
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setError(''); setForm({ code: '', name: '', address: '', city: '' }); }}
                  style={{ flex: 1, padding: '14px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 2, padding: '14px', background: submitting ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '12px', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700, boxShadow: submitting ? 'none' : '0 4px 14px rgba(109,40,217,0.4)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  {submitting ? 'Menyimpan...' : '✓ Simpan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '460px',
            background: 'var(--bg-surface-opaque)',
            border: '1px solid var(--border-color)', borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Edit Cabang</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Ubah data cabang atau outlet</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#f87171', fontSize: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleEditSubmit} style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{ width: '3px', height: '18px', background: '#3b82f6', borderRadius: '2px' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#3b82f6' }}>Informasi Cabang</span>
              </div>

              {/* Kode Cabang */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kode Cabang <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase', transition: 'border-color 0.2s' }}
                  placeholder="Contoh: JKT-01, BGR-02"
                  value={editForm.code}
                  onChange={e => setEditForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              {/* Nama Cabang */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nama Cabang <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  placeholder="Contoh: Cabang Sudirman"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              {/* Kota */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kota
                </label>
                <input
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  placeholder="Contoh: Jakarta"
                  value={editForm.city}
                  onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))}
                />
              </div>

              {/* Alamat */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Alamat Lengkap
                </label>
                <textarea
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: '90px', transition: 'border-color 0.2s' }}
                  placeholder="Masukkan alamat lengkap cabang..."
                  value={editForm.address}
                  onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                  rows={3}
                />
              </div>
              
              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Status
                </label>
                <select
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  value={editForm.status}
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                >
                  <option value="Active" style={{ background: 'var(--bg-surface-opaque)', color: 'var(--text-primary)' }}>Aktif</option>
                  <option value="Inactive" style={{ background: 'var(--bg-surface-opaque)', color: 'var(--text-primary)' }}>Nonaktif</option>
                </select>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{ flex: 1, padding: '14px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 2, padding: '14px', background: submitting ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: '12px', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700, boxShadow: submitting ? 'none' : '0 4px 14px rgba(37,99,235,0.4)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  {submitting ? 'Menyimpan...' : '✓ Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchManagement;

