import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { disciplineApi, staffApi } from '../services/api';

const TYPE_OPTIONS = ['Teguran Lisan', 'Teguran Tertulis', 'SP-1', 'SP-2', 'SP-3'];

const TYPE_COLOR = {
  'Teguran Lisan':    { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: 'rgba(245,158,11,0.4)' },
  'Teguran Tertulis': { bg: 'var(--color-warning-bg)', color: '#d97706', border: 'rgba(249,115,22,0.4)' },
  'SP-1':             { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'rgba(239,68,68,0.4)' },
  'SP-2':             { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'rgba(220,38,38,0.5)' },
  'SP-3':             { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'rgba(239,68,68,0.6)' },
};

const STATUS_COLOR = {
  Aktif:    { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)' },
  Resolved: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
};

const iStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
  padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px',
  width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
};
const lStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' };

function getTodayLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const getEmptyForm = () => ({
  employee_id: '',
  type: 'SP-1',
  date: getTodayLocalDateStr(),
  description: '',
  issued_by: '',
});

export default function Discipline() {
  const [records, setRecords]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [stats, setStats]         = useState([]);

  const [filterEmp, setFilterEmp]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(getEmptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [resolveRec, setResolveRec]     = useState(null);
  const [resolveNote, setResolveNote]   = useState('');
  const [resolving, setResolving]       = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!showForm && !resolveRec) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (resolveRec && !resolving) setResolveRec(null);
        else if (showForm && !submitting) setShowForm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm, resolveRec, submitting, resolving]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = {};
      if (filterEmp)    params.employee_id = filterEmp;
      if (filterStatus) params.status = filterStatus;
      if (filterType)   params.type = filterType;
      const [recRes, statsRes] = await Promise.all([
        disciplineApi.getAll(params),
        disciplineApi.getStats(),
      ]);
      if (recRes.success) setRecords(recRes.data || []);
      else setFetchError(recRes.message || 'Gagal memuat catatan pelanggaran.');
      if (statsRes.success) setStats(statsRes.data || []);
    } catch (err) {
      setFetchError(err.message || 'Gagal memuat catatan pelanggaran.');
    } finally {
      setLoading(false);
    }
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
        setForm(getEmptyForm());
        fetchAll();
      } else {
        setFormError(res.message || 'Gagal menyimpan catatan pelanggaran.');
      }
    } catch (err) {
      setFormError(err.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
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
        setResolveError(res.message || 'Gagal menyelesaikan sanksi.');
      }
    } catch (err) {
      setResolveError(err.message || 'Terjadi kesalahan.');
    } finally {
      setResolving(false);
    }
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`Hapus catatan "${rec.type}" untuk ${rec.employee_name}?`)) return;
    try {
      const res = await disciplineApi.remove(rec.id);
      if (res.success) { setMessage({ type: 'success', text: res.message }); fetchAll(); }
      else alert(res.message || 'Gagal menghapus catatan.');
    } catch (err) { alert(err.message || 'Gagal menghapus catatan.'); }
  };

  const totalAktif = stats
    .filter(s => s.status === 'Aktif')
    .reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  const totalResolved = stats
    .filter(s => s.status === 'Resolved')
    .reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  const totalSP3 = stats
    .filter(s => s.type === 'SP-3' && s.status === 'Aktif')
    .reduce((sum, s) => sum + (Number(s.count) || 0), 0);

  const modalBack = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' };
  const modalBox  = { background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Disiplin & Pelanggaran</h1>
          <p className="page-subtitle">Pencatatan SP, teguran, dan riwayat pelanggaran karyawan.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(''); setForm(getEmptyForm()); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Catat Sanksi
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: message.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', border: `1px solid ${message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' }}>&times;</button>
        </div>
      )}

      {fetchError && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.35)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>⚠ {fetchError}</span>
          <button type="button" onClick={fetchAll} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>Coba Lagi</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid responsive-grid-3" style={{ marginBottom: '20px' }}>
        {[
          { label: 'Sanksi Aktif',  value: totalAktif,    color: 'var(--color-danger)' },
          { label: 'Diselesaikan',  value: totalResolved, color: 'var(--color-success)' },
          { label: 'SP-3 Aktif',    value: totalSP3,      color: 'var(--color-danger)' },
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
          <button type="button" className="btn btn-secondary" onClick={() => { setFilterEmp(''); setFilterType(''); setFilterStatus(''); }}>Reset Filter</button>
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
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{rec.employee_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rec.employee_type} · {rec.branch_name || '—'}</div>
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{rec.type}</span>
                    </td>
                    <td style={{ padding: '12px', verticalAlign: 'top', fontSize: '13px', whiteSpace: 'nowrap' }}>{rec.date}</td>
                    <td style={{ padding: '12px', verticalAlign: 'top', fontSize: '13px', maxWidth: '240px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.description}>{rec.description}</div>
                      {rec.status === 'Resolved' && rec.resolution_note && (
                        <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '4px' }}>✓ {rec.resolution_note}</div>
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
                          type="button"
                          onClick={() => { setResolveRec(rec); setResolveNote(''); setResolveError(''); }}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--color-success)', background: 'var(--color-success-bg)', color: 'var(--color-success)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginRight: '6px', fontFamily: 'inherit' }}
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(rec)}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
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
      {showForm && createPortal(
        <div style={modalBack} onClick={e => { if (e.target === e.currentTarget && !submitting) setShowForm(false); }}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Catat Sanksi / Pelanggaran</h3>
              <button type="button" disabled={submitting} onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lStyle}>Karyawan <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <select style={iStyle} value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">— Pilih Karyawan —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_type} · {emp.branch_name || 'Tanpa Cabang'})</option>)}
                </select>
              </div>
              <div className="responsive-grid-2" style={{ gap: '14px' }}>
                <div>
                  <label style={lStyle}>Tipe Sanksi <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <select style={iStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lStyle}>Tanggal <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input type="date" style={iStyle} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={lStyle}>Keterangan Pelanggaran <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <textarea style={{ ...iStyle, resize: 'vertical', minHeight: '80px' }} rows={3}
                  placeholder="Tuliskan keterangan pelanggaran secara singkat dan jelas..."
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
              </div>
              <div>
                <label style={lStyle}>Dikeluarkan Oleh</label>
                <input style={iStyle} placeholder="Nama HRD / Atasan" value={form.issued_by} onChange={e => setForm(p => ({ ...p, issued_by: e.target.value }))} />
              </div>
              {formError && <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '13px' }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" className="btn btn-secondary" disabled={submitting} onClick={() => setShowForm(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Resolve modal */}
      {resolveRec && createPortal(
        <div style={modalBack} onClick={e => { if (e.target === e.currentTarget && !resolving) setResolveRec(null); }}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Resolve Sanksi</h3>
              <button type="button" disabled={resolving} onClick={() => setResolveRec(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong>{resolveRec.type}</strong> — {resolveRec.employee_name} ({resolveRec.date})
            </p>
            <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lStyle}>Catatan Penyelesaian <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <textarea style={{ ...iStyle, resize: 'vertical', minHeight: '80px' }} rows={3}
                  placeholder="Contoh: Karyawan telah menerima pembinaan dan berjanji tidak mengulangi..."
                  value={resolveNote} onChange={e => setResolveNote(e.target.value)} required autoFocus />
              </div>
              {resolveError && <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '13px' }}>{resolveError}</p>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" disabled={resolving} onClick={() => setResolveRec(null)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={resolving} style={{ background: '#10b981', borderColor: '#10b981' }}>{resolving ? 'Menyimpan...' : 'Tandai Selesai'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
