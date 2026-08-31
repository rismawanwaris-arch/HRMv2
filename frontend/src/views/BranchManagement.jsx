import React, { useState, useEffect } from 'react';
import { branchApi } from '../services/api';

const iStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' };
const lStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' };

const EMPTY_FORM = { code: '', name: '', address: '', city: '', location_type: 'Konter', has_petshop: false, rent_amount: '' };

function Field({ label, required, children }) {
  return (
    <div>
      <label style={lStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
    </div>
  );
}

// Defined OUTSIDE BranchManagement to prevent remount on every parent re-render.
function BranchForm({ data, setData, onSubmit, isEdit, error, submitting, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div style={{ width: '3px', height: '18px', background: isEdit ? '#3b82f6' : '#8b5cf6', borderRadius: '2px' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: isEdit ? '#3b82f6' : '#8b5cf6' }}>Informasi Cabang</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Field label="Kode Cabang" required>
          <input style={{ ...iStyle, fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
            placeholder="JKT-01" value={data.code}
            onChange={e => setData(p => ({ ...p, code: e.target.value.toUpperCase() }))} required />
        </Field>
        <Field label="Tipe Lokasi">
          <select style={iStyle} value={data.location_type} onChange={e => setData(p => ({ ...p, location_type: e.target.value }))}>
            <option value="Konter">Konter (Outlet)</option>
            <option value="Gudang">Gudang (Pusat)</option>
          </select>
        </Field>
      </div>

      <Field label="Nama Cabang" required>
        <input style={iStyle} placeholder="Cabang Sudirman" value={data.name}
          onChange={e => setData(p => ({ ...p, name: e.target.value }))} required />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Field label="Kota">
          <input style={iStyle} placeholder="Jakarta" value={data.city}
            onChange={e => setData(p => ({ ...p, city: e.target.value }))} />
        </Field>
        <Field label="Biaya Sewa / Bulan (Rp)">
          <input type="number" min="0" style={iStyle} placeholder="0" value={data.rent_amount}
            onChange={e => setData(p => ({ ...p, rent_amount: e.target.value }))} />
        </Field>
      </div>

      <Field label="Alamat Lengkap">
        <textarea style={{ ...iStyle, resize: 'vertical', minHeight: '80px' }}
          placeholder="Masukkan alamat lengkap cabang..." value={data.address}
          onChange={e => setData(p => ({ ...p, address: e.target.value }))} rows={3} />
      </Field>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setData(p => ({ ...p, has_petshop: !p.has_petshop }))}>
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${data.has_petshop ? '#10b981' : 'var(--border-color)'}`, background: data.has_petshop ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
            {data.has_petshop && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Punya Petshop</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tampilkan komponen petshop di laporan</div>
          </div>
        </div>

        {isEdit && (
          <Field label="Status">
            <select style={iStyle} value={data.status} onChange={e => setData(p => ({ ...p, status: e.target.value }))}>
              <option value="Active">Aktif</option>
              <option value="Inactive">Nonaktif</option>
            </select>
          </Field>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#f87171', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
        <button type="button" onClick={onCancel}
          style={{ flex: 1, padding: '14px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit' }}>
          Batal
        </button>
        <button type="submit" disabled={submitting}
          style={{ flex: 2, padding: '14px', background: submitting ? 'rgba(139,92,246,0.4)' : isEdit ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '12px', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit' }}>
          {submitting ? 'Menyimpan...' : isEdit ? '✓ Simpan Perubahan' : '✓ Simpan Cabang'}
        </button>
      </div>
    </form>
  );
}

function BranchManagement({ setView }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, id: null, status: 'Active' });
  const [error, setError] = useState('');

  useEffect(() => { fetchBranches(); }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await branchApi.getAll();
      if (res.success) setBranches(res.data);
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
      const res = await branchApi.create({ ...form, has_petshop: form.has_petshop ? 1 : 0, rent_amount: parseFloat(form.rent_amount) || 0 });
      if (res.success) {
        setBranches(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setShowAddModal(false);
        setForm(EMPTY_FORM);
      } else {
        setError(res.message || 'Gagal menambahkan cabang.');
      }
    } catch (err) {
      setError(err.message || 'Gagal terhubung ke server.');
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
      const res = await branchApi.update(editForm.id, { ...editForm, has_petshop: editForm.has_petshop ? 1 : 0, rent_amount: parseFloat(editForm.rent_amount) || 0 });
      if (res.success) {
        setBranches(prev => prev.map(b => b.id === editForm.id ? res.data : b).sort((a, b) => a.name.localeCompare(b.name)));
        setShowEditModal(false);
      } else {
        setError(res.message || 'Gagal memperbarui cabang.');
      }
    } catch (err) {
      setError(err.message || 'Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (branch) => {
    if (!window.confirm(`Hapus cabang "${branch.name}"?\n\nKaryawan aktif yang terdaftar di cabang ini akan menjadi tidak memiliki cabang.`)) return;
    try {
      const res = await branchApi.delete(branch.id);
      if (res.success) {
        setBranches(prev => prev.filter(b => b.id !== branch.id));
      } else {
        alert(res.message || 'Gagal menghapus cabang.');
      }
    } catch (err) {
      alert(err.message || 'Gagal terhubung ke server.');
    }
  };

  const openEdit = (branch) => {
    setEditForm({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      city: branch.city || '',
      status: branch.status || 'Active',
      location_type: branch.location_type || 'Konter',
      has_petshop: !!branch.has_petshop,
      rent_amount: branch.rent_amount || '',
    });
    setError('');
    setShowEditModal(true);
  };

  const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(n) : '0';

  const totalActive = branches.filter(b => b.status === 'Active').length;
  const totalKonter = branches.filter(b => b.location_type === 'Konter').length;
  const totalGudang = branches.filter(b => b.location_type === 'Gudang').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Cabang Outlet</h1>
          <p className="page-subtitle">Kelola daftar cabang, konter, dan gudang perusahaan.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAddModal(true); setError(''); setForm(EMPTY_FORM); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Cabang
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        {[
          { label: 'Total Cabang', value: branches.length, color: 'var(--color-primary)', desc: 'Semua cabang' },
          { label: 'Aktif', value: totalActive, color: '#10b981', desc: `Konter: ${totalKonter} · Gudang: ${totalGudang}` },
          { label: 'Punya Petshop', value: branches.filter(b => b.has_petshop).length, color: '#f59e0b', desc: 'Komponen aktif' },
        ].map(s => (
          <div key={s.label} className="glass-panel stat-card" style={{ borderColor: `${s.color}40` }}>
            <div className="stat-card-title">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-card-desc">{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data cabang...
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
                  <th>Tipe</th>
                  <th>Kota</th>
                  <th>Karyawan</th>
                  <th>Petshop</th>
                  <th>Sewa/Bln</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(branch => (
                  <tr key={branch.id}>
                    <td>
                      <span style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px' }}>
                        {branch.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{branch.name}</td>
                    <td>
                      <span style={{ background: branch.location_type === 'Gudang' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: branch.location_type === 'Gudang' ? '#8b5cf6' : '#3b82f6', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                        {branch.location_type || 'Konter'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{branch.city || '-'}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'center' }}>
                      {branch.employee_count ?? 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {branch.has_petshop
                        ? <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {branch.rent_amount ? `Rp ${fmt(branch.rent_amount)}` : '—'}
                    </td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: branch.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', color: branch.status === 'Active' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {branch.status === 'Active' ? '● Aktif' : '● Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(branch)}
                        style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(59,130,246,0.22)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(branch)}
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}>
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

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: '0 32px 64px rgba(0,0,0,0.25)', marginTop: 'auto', marginBottom: 'auto' }}>
            <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Tambah Cabang Baru</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Daftarkan cabang, konter, atau gudang</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setError(''); }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 0 0' }}>
              <BranchForm data={form} setData={setForm} onSubmit={handleAdd} isEdit={false}
                error={error} submitting={submitting}
                onCancel={() => { setShowAddModal(false); setError(''); }} />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: '0 32px 64px rgba(0,0,0,0.25)', marginTop: 'auto', marginBottom: 'auto' }}>
            <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Cabang</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Ubah data cabang atau outlet</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setError(''); }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 0 0' }}>
              <BranchForm data={editForm} setData={setEditForm} onSubmit={handleEditSubmit} isEdit={true}
                error={error} submitting={submitting}
                onCancel={() => { setShowEditModal(false); setError(''); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchManagement;
