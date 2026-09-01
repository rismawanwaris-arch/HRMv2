import React, { useState, useEffect, useCallback } from 'react';
import { disciplineApi, staffApi } from '../services/api';

const TYPE_OPTIONS = ['Teguran Lisan', 'Teguran Tertulis', 'SP-1', 'SP-2', 'SP-3'];

const TYPE_COLOR = {
  'Teguran Lisan':    { bg: 'rgba(251,191,36,0.15)',  color: '#d97706', border: 'rgba(251,191,36,0.4)' },
  'Teguran Tertulis': { bg: 'rgba(249,115,22,0.15)',  color: '#ea580c', border: 'rgba(249,115,22,0.4)' },
  'SP-1':             { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', border: 'rgba(239,68,68,0.4)' },
  'SP-2':             { bg: 'rgba(220,38,38,0.18)',   color: '#b91c1c', border: 'rgba(220,38,38,0.5)' },
  'SP-3':             { bg: 'rgba(127,29,29,0.2)',    color: '#7f1d1d', border: 'rgba(127,29,29,0.5)' },
};

const STATUS_COLOR = {
  Aktif:    { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
  Resolved: { bg: 'rgba(16,185,129,0.12)', color: '#059669' },
};

const iStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
  padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px',
  width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
};
const lStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' };

const EMPTY_FORM = { employee_id: '', type: 'SP-1', date: new Date().toISOString().slice(0, 10), description: '', issued_by: '' };

export default function Discipline() {
  const [records, setRecords]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState([]);

  const [filterEmp, setFilterEmp]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [resolveRec, setResolveRec]     = useState(null);
  const [resolveNote, setResolveNote]   = useState('');
  const [resolving, setResolving]       = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [message, setMessage] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterEmp)    params.employee_id = filterEmp;
      if (filterStatus) params.status = filterStatus;
      if (filterType)   params.type = filterType;
      const [recRes, statsRes] = await Promise.all([
        disciplineApi.getAll(params),
        disciplineApi.getStats(),
      ]);
      if (recRes.success) setRecords(recRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [filterEmp, filterStatus, filterType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    staffApi.getAll({ status: 'Active' }).then(r => { if (r.success) setEmployees(r.data); }).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.employee_id || !form.description.trim()) {
      setFormError('Pilih karyawan dan isi keterangan pelanggaran.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await disciplineApi.create(form);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setShowForm(false);
        setForm(EMPTY_FORM);
        fetchAll();
      } else {
        setFormError(res.message);
      }
    } catch { setFormError('Terjadi kesalahan. Coba lagi.'); }
    finally { setSubmitting(false); }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    setResolveError('');
    if (!resolveNote.trim()) { setResolveError('Catatan penyelesaian wajib diisi.'); return; }
    setResolving(true);
    try {
      const res = await disciplineApi.resolve(resolveRec.id, { resolution_note: resolveNote });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setResolveRec(null);
        setResolveNote('');
        fetchAll();
      } else {
        setResolveError(res.message);
      }
    } catch { setResolveError('Terjadi kesalahan.'); }
    finally { setResolving(false); }
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`Hapus catatan "${rec.type}" untuk ${rec.employee_name}?`)) return;
    try {
      const res = await disciplineApi.remove(rec.id);
      if (res.success) { setMessage({ type: 'success', text: res.message }); fetchAll(); }
      else alert(res.message);
    } catch { alert('Gagal menghapus catatan.'); }
  };

  const totalAktif    = records.filter(r => r.status === 'Aktif').length;
  const totalResolved = records.filter(r => r.status === 'Resolved').length;
  const totalSP3      = records.filter(r => r.type === 'SP-3' && r.status === 'Aktif').length;

  const modalBack = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
  const modalBox  = { background: 'var(--bg-surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Disiplin & Pelanggaran</h1>
          <p className="page-subtitle">Pencatatan SP, teguran, dan riwayat pelanggaran karyawan.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(''); setForm(EMPTY_FORM); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Catat Sanksi
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: message.type === 'success' ? '#047857' : '#b91c1c', border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
        {[
          { label: 'Sanksi Aktif',  value: totalAktif,    color: '#ef4444' },
          { label: 'Diselesaikan',  value: totalResolved,  color: '#10b981' },
          { label: 'SP-3 Aktif',    value: totalSP3,       color: '#7f1d1d' },
        ].map(s => (
          <div key={s.label} className="glass-panel stat-card">
            <div className="stat-card-title">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select style={{ ...iStyle, width: 'auto', minWidth: '180px' }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="">Semua Karyawan</option>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <select style={{ ...iStyle, width: 'auto', minWidth: '160px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Semua Tipe</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ ...iStyle, width: 'auto', minWidth: '140px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="Aktif">Aktif</option>
          <option value="Resolved">Resolved</option>
        </select>
        {(filterEmp || filterType || filterStatus) && (
          <button className="btn btn-secondary" onClick={() => { setFilterEmp(''); setFilterType(''); setFilterStatus(''); }}>Reset Filter</button>
        )}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data...</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.4 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p style={{ margin: 0, fontSize: '14px' }}>Tidak ada catatan pelanggaran.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                {['Karyawan', 'Tipe Sanksi', 'Tanggal', 'Keterangan', 'Dikeluarkan Oleh', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const tc = TYPE_COLOR[rec.type] || {};
                const sc = STATUS_COLOR[rec.status] || {};
                return (
                  <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{rec.employee_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rec.employee_type} · {rec.branch_name || '—'}</div>
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{rec.type}</span>
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top', fontSize: '13px', whiteSpace: 'nowrap' }}>{rec.date}</td>
                    <td style={{ padding: '12px', verticalAlign: 'top', fontSize: '13px', maxWidth: '240px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.description}>{rec.description}</div>
                      {rec.status === 'Resolved' && rec.resolution_note && (
                        <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>✓ {rec.resolution_note}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top', fontSize: '13px', color: 'var(--text-secondary)' }}>{rec.issued_by || '—'}</td>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: sc.bg, color: sc.color }}>{rec.status}</span>
                      {rec.status === 'Resolved' && rec.resolved_at && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{rec.resolved_at}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {rec.status === 'Aktif' && (
                        <button
                          onClick={() => { setResolveRec(rec); setResolveNote(''); setResolveError(''); }}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#059669', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginRight: '6px', fontFamily: 'inherit' }}
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rec)}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add record modal */}
      {showForm && (
        <div style={modalBack} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700 }}>Catat Sanksi / Pelanggaran</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lStyle}>Karyawan <span style={{ color: '#ef4444' }}>*</span></label>
                <select style={iStyle} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">— Pilih Karyawan —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_type} · {emp.branch_name || 'Tanpa Cabang'})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={lStyle}>Tipe Sanksi <span style={{ color: '#ef4444' }}>*</span></label>
                  <select style={iStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Tanggal <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" style={iStyle} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={lStyle}>Keterangan Pelanggaran <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea style={{ ...iStyle, resize: 'vertical', minHeight: '80px' }} rows={3}
                  placeholder="Tuliskan keterangan pelanggaran secara singkat dan jelas..."
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
              </div>
              <div>
                <label style={lStyle}>Dikeluarkan Oleh</label>
                <input style={iStyle} placeholder="Nama HRD / Atasan" value={form.issued_by} onChange={e => setForm(p => ({ ...p, issued_by: e.target.value }))} />
              </div>
              {formError && <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolveRec && (
        <div style={modalBack} onClick={e => { if (e.target === e.currentTarget) setResolveRec(null); }}>
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Resolve Sanksi</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong>{resolveRec.type}</strong> — {resolveRec.employee_name} ({resolveRec.date})
            </p>
            <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lStyle}>Catatan Penyelesaian <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea style={{ ...iStyle, resize: 'vertical', minHeight: '80px' }} rows={3}
                  placeholder="Contoh: Karyawan telah menerima pembinaan dan berjanji tidak mengulangi..."
                  value={resolveNote} onChange={e => setResolveNote(e.target.value)} required autoFocus />
              </div>
              {resolveError && <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>{resolveError}</p>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResolveRec(null)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={resolving} style={{ background: '#10b981', borderColor: '#10b981' }}>{resolving ? 'Menyimpan...' : 'Tandai Selesai'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
