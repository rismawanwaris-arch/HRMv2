import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { branchApi } from '../services/api';

const iStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', width: '100%', boxSizing: 'border-box', display: 'block', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' };
const lStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' };

const EMPTY_FORM = { code: '', name: '', address: '', city: '', location_type: 'Konter', has_petshop: false, rent_amount: '', latitude: '', longitude: '', geofence_radius_m: 100 };

function Field({ label, required, children }) {
  return (
    <div>
      <label style={lStyle}>{label}{required && <span style={{ color: 'var(--color-danger)' }}> *</span>}</label>
      {children}
    </div>
  );
}

// Defined OUTSIDE BranchManagement to prevent remount on every parent re-render.
function BranchForm({ data, setData, onSubmit, isEdit, error, submitting, onCancel }) {
  return (
    <form onSubmit={onSubmit} style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div style={{ width: '3px', height: '18px', background: isEdit ? 'var(--color-info)' : 'var(--color-primary)', borderRadius: '2px' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: isEdit ? 'var(--color-info)' : 'var(--color-primary)' }}>Informasi Cabang</span>
      </div>

      <div className="responsive-grid-2" style={{ gap: '14px' }}>
        <Field label="Kode Cabang" required>
          <input style={{ ...iStyle, fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
            placeholder="JKT-01" value={data.code}
            onChange={e => setData(p => ({ ...p, code: e.target.value.toUpperCase() }))} required />
        </Field>
        <Field label="Tipe Lokasi">
          <select style={iStyle} value={data.location_type} onChange={e => setData(p => ({ ...p, location_type: e.target.value }))}>
            <option value="Konter">Konter (Outlet)</option>
            <option value="Gudang">Gudang (Pusat)</option>
            <option value="Kantor/Pusat">Kantor / Pusat (Admin/CS)</option>
          </select>
        </Field>
      </div>

      <Field label="Nama Cabang" required>
        <input style={iStyle} placeholder="Cabang Sudirman" value={data.name}
          onChange={e => setData(p => ({ ...p, name: e.target.value }))} required />
      </Field>

      <div className="responsive-grid-2" style={{ gap: '14px' }}>
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

      <div className="responsive-grid-3" style={{ gap: '12px' }}>
        <Field label="Latitude GPS (opsional)">
          <input type="number" step="any" style={iStyle} placeholder="-6.200000" value={data.latitude ?? ''}
            onChange={e => setData(p => ({ ...p, latitude: e.target.value }))} />
        </Field>
        <Field label="Longitude GPS (opsional)">
          <input type="number" step="any" style={iStyle} placeholder="106.816666" value={data.longitude ?? ''}
            onChange={e => setData(p => ({ ...p, longitude: e.target.value }))} />
        </Field>
        <Field label="Radius Geofence (m)">
          <input type="number" min="10" max="10000" style={iStyle} placeholder="100" value={data.geofence_radius_m ?? 100}
            onChange={e => setData(p => ({ ...p, geofence_radius_m: e.target.value }))} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', userSelect: 'none', marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={!!data.has_petshop}
            onChange={e => setData(p => ({ ...p, has_petshop: e.target.checked }))}
            style={{ width: '16px', height: '16px', accentColor: 'var(--color-success)', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Punya Petshop</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tampilkan komponen petshop di laporan</div>
          </div>
        </label>

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
        <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', borderRadius: '10px', padding: '12px 16px', color: 'var(--color-danger)', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
        <button type="button" onClick={onCancel}
          style={{ flex: 1, padding: '14px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit' }}>
          Batal
        </button>
        <button type="submit" disabled={submitting} className="btn btn-primary"
          style={{ flex: 2, padding: '14px', borderRadius: '12px', justifyContent: 'center', opacity: submitting ? 0.65 : 1, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700 }}>
          {submitting ? 'Menyimpan...' : isEdit ? '✓ Simpan Perubahan' : '✓ Simpan Cabang'}
        </button>
      </div>
    </form>
  );
}

function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, id: null, status: 'Active' });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  useEffect(() => { fetchBranches(); }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (showEditModal) { setShowEditModal(false); setError(''); }
      else if (showAddModal) { setShowAddModal(false); setError(''); }
    };
    if (showAddModal || showEditModal) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
    return undefined;
  }, [showAddModal, showEditModal]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setFetchError('');
      const res = await branchApi.getAll();
      if (res.success) setBranches(res.data || []);
      else setFetchError(res.message || 'Gagal memuat data cabang.');
    } catch (err) {
      setFetchError(err.message || 'Gagal terhubung ke server saat memuat cabang.');
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
      const res = await branchApi.create({
        ...form,
        has_petshop: form.has_petshop ? 1 : 0,
        rent_amount: parseFloat(form.rent_amount) || 0,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
        geofence_radius_m: parseInt(form.geofence_radius_m, 10) || 100,
      });
      if (res.success) {
        setBranches(prev => [...prev, { ...res.data, employee_count: res.data?.employee_count ?? 0 }].sort((a, b) => a.name.localeCompare(b.name)));
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
      const res = await branchApi.update(editForm.id, {
        ...editForm,
        has_petshop: editForm.has_petshop ? 1 : 0,
        rent_amount: parseFloat(editForm.rent_amount) || 0,
        latitude: editForm.latitude === '' ? null : editForm.latitude,
        longitude: editForm.longitude === '' ? null : editForm.longitude,
        geofence_radius_m: parseInt(editForm.geofence_radius_m, 10) || 100,
      });
      if (res.success) {
        setBranches(prev => prev.map(b => b.id === editForm.id ? { ...b, ...res.data, employee_count: res.data?.employee_count ?? b.employee_count } : b).sort((a, b) => a.name.localeCompare(b.name)));
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
    if ((branch.employee_count || 0) > 0) {
      alert(`Cabang "${branch.name}" masih memiliki ${branch.employee_count} karyawan aktif. Pindahkan karyawan terlebih dahulu sebelum menghapus.`);
      return;
    }
    if (!window.confirm(`Hapus cabang "${branch.name}"?\n\nCabang yang masih memiliki riwayat data operasional, aset, laporan keuangan, atau gaji tidak dapat dihapus dan sebaiknya dinonaktifkan via Edit.`)) return;
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

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    setImportMessage(null);
    try {
      const data = await branchApi.importExcel(formData);
      if (data.success) {
        const errDetail = data.errors && data.errors.length > 0
          ? ` (${data.errors.slice(0, 3).join('; ')}${data.errors.length > 3 ? '...' : ''})`
          : '';
        setImportMessage({ type: data.errors && data.errors.length > 0 ? 'error' : 'success', text: data.message + errDetail });
        fetchBranches();
      } else {
        setImportMessage({ type: 'error', text: data.message || 'Gagal mengimpor data cabang.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: err.message || 'Terjadi kesalahan saat import data.' });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
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
      latitude: branch.latitude ?? '',
      longitude: branch.longitude ?? '',
      geofence_radius_m: branch.geofence_radius_m ?? 100,
    });
    setError('');
    setShowEditModal(true);
  };

  const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(n) : '0';

  const activeList = branches.filter(b => b.status === 'Active');
  const totalActive = activeList.length;
  const totalKonter = activeList.filter(b => b.location_type === 'Konter').length;
  const totalGudang = activeList.filter(b => b.location_type === 'Gudang' || b.location_type === 'Kantor/Pusat').length;

  const filteredBranches = branches.filter(b => {
    if (typeFilter && b.location_type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (b.name || '').toLowerCase().includes(q) ||
        (b.code || '').toLowerCase().includes(q) ||
        (b.city || '').toLowerCase().includes(q) ||
        (b.address || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Cabang Outlet</h1>
          <p className="page-subtitle">Kelola daftar cabang, konter, dan gudang perusahaan.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={importRef} onChange={handleImportExcel} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const resp = await branchApi.downloadTemplate();
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'template_import_cabang.xlsx'; a.click();
                URL.revokeObjectURL(url);
              } catch { alert('Gagal mengunduh template.'); }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><line x1="12" y1="15" x2="12" y2="3"/><polyline points="7 10 12 15 17 10"/></svg>
            Template
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => importRef.current && importRef.current.click()} disabled={importing}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Mengimpor...' : 'Import Excel'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setShowAddModal(true); setError(''); setForm(EMPTY_FORM); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Cabang
          </button>
        </div>
      </div>

      {importMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', backgroundColor: importMessage.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: importMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', border: `1px solid ${importMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`, fontSize: '13px', fontWeight: 500 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span>{importMessage.text}</span>
            <button type="button" onClick={() => setImportMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '18px', lineHeight: 1 }}>&times;</button>
          </div>
        </div>
      )}

      {fetchError && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
          <span>{fetchError}</span>
          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={fetchBranches}>Coba Lagi</button>
        </div>
      )}

      <div className="stats-grid responsive-grid-3" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Total Cabang', value: branches.length, color: 'var(--color-primary)', desc: 'Semua cabang' },
          { label: 'Aktif', value: totalActive, color: 'var(--color-success)', desc: `Konter: ${totalKonter} · Kantor/Gudang: ${totalGudang}` },
          { label: 'Punya Petshop', value: branches.filter(b => b.has_petshop).length, color: 'var(--color-warning)', desc: 'Komponen aktif' },
        ].map(s => (
          <div key={s.label} className="glass-panel stat-card">
            <div className="stat-card-title">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-card-desc">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...iStyle, width: '260px', padding: '9px 13px', fontSize: '13px' }}
            placeholder="Cari nama cabang, kode, atau kota..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select
            style={{ ...iStyle, width: '180px', padding: '9px 13px', fontSize: '13px' }}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">Semua Tipe Lokasi</option>
            <option value="Konter">Konter (Outlet)</option>
            <option value="Gudang">Gudang (Pusat)</option>
            <option value="Kantor/Pusat">Kantor / Pusat</option>
          </select>
          {(searchQuery || typeFilter) && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '12px' }}
              onClick={() => { setSearchQuery(''); setTypeFilter(''); }}
            >
              Reset Filter
            </button>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Menampilkan <strong style={{ color: 'var(--text-primary)' }}>{filteredBranches.length}</strong> cabang
        </div>
      </div>

      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data cabang...
          </div>
        ) : filteredBranches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Tidak ada cabang ditemukan</p>
            <p style={{ fontSize: '13px' }}>Klik <strong>"Tambah Cabang"</strong> untuk menambahkan cabang baru.</p>
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
                {filteredBranches.map(branch => (
                  <tr key={branch.id}>
                    <td>
                      <span style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px' }}>
                        {branch.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{branch.name}</td>
                    <td>
                      <span style={{ background: branch.location_type === 'Gudang' || branch.location_type === 'Kantor/Pusat' ? 'rgba(139,92,246,0.15)' : 'var(--color-info-bg)', color: branch.location_type === 'Gudang' || branch.location_type === 'Kantor/Pusat' ? 'var(--color-primary)' : 'var(--color-info)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                        {branch.location_type || 'Konter'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{branch.city || '-'}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'center' }}>
                      {branch.employee_count ?? 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {branch.has_petshop
                        ? <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {branch.rent_amount ? `Rp ${fmt(branch.rent_amount)}` : '—'}
                    </td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: branch.status === 'Active' ? 'var(--color-success-bg)' : 'var(--bg-secondary)', color: branch.status === 'Active' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {branch.status === 'Active' ? '● Aktif' : '● Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => openEdit(branch)}
                        style={{ background: 'var(--color-info-bg)', border: '1px solid rgba(59,130,246,0.25)', color: 'var(--color-info)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(branch)}
                        style={{ background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--color-danger)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
      {showAddModal && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); setError(''); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}
        >
          <div style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: '0 32px 64px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '24px 32px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Tambah Cabang Baru</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Daftarkan cabang, konter, atau gudang</p>
              </div>
              <button type="button" onClick={() => { setShowAddModal(false); setError(''); }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 0 0' }}>
              <BranchForm data={form} setData={setForm} onSubmit={handleAdd} isEdit={false}
                error={error} submitting={submitting}
                onCancel={() => { setShowAddModal(false); setError(''); }} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {showEditModal && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowEditModal(false); setError(''); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}
        >
          <div style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: '0 32px 64px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '24px 32px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Cabang</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Ubah data cabang atau outlet</p>
              </div>
              <button type="button" onClick={() => { setShowEditModal(false); setError(''); }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 0 0' }}>
              <BranchForm data={editForm} setData={setEditForm} onSubmit={handleEditSubmit} isEdit={true}
                error={error} submitting={submitting}
                onCancel={() => { setShowEditModal(false); setError(''); }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default BranchManagement;
