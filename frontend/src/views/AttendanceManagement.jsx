import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { attendanceApi, branchApi } from '../services/api';

const fmt = (n) => n != null ? new Intl.NumberFormat('id-ID').format(n) : '0';

const STATUS_COLORS = {
  'Hadir':       { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
  'Telat':       { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'Tidak Hadir': { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  'Izin':        { bg: 'rgba(99,102,241,0.15)',  color: '#6366f1' },
  'Sakit':       { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  'Cuti':        { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
  'Belum Absen': { bg: 'rgba(107,114,128,0.1)',  color: '#6b7280' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS['Belum Absen'];
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>{status || 'Belum Absen'}</span>
  );
}

const inputS = {
  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
  padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return opts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab 1: Input Harian
// ──────────────────────────────────────────────────────────────────────────────

function InputHarian({ branches }) {
  const [date, setDate] = useState(todayStr);
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [cutoffs, setCutoffs] = useState({ pagi: '06:30', siang: '14:30' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  const fetchRows = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError('');
    setSaved({});
    try {
      const params = { date };
      if (branchId) params.branch_id = branchId;
      const res = await attendanceApi.getByDate(params);
      if (res.success) {
        setRows(res.data || []);
        if (res.cutoffs) {
          setCutoffs({
            pagi: res.cutoffs.pagi || res.cutoffs.morning || '06:30',
            siang: res.cutoffs.siang || res.cutoffs.afternoon || '14:30',
          });
        }
        const init = {};
        for (const r of (res.data || [])) {
          init[r.id] = {
            shift: r.shift || 'Pagi',
            check_in_time: r.check_in_time || '',
            status: r.status === 'Belum Absen' ? 'Tidak Hadir' : r.status,
            notes: r.notes || '',
          };
        }
        setEdits(init);
      } else {
        setError(res.message || 'Gagal memuat data absensi.');
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat data absensi.');
    } finally {
      setLoading(false);
    }
  }, [date, branchId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const set = (empId, field, val) => {
    setSaved(p => {
      if (!p[empId]) return p;
      const next = { ...p };
      delete next[empId];
      return next;
    });
    setEdits(p => {
      const cur = p[empId] || { shift: 'Pagi', check_in_time: '', status: 'Tidak Hadir', notes: '' };
      const updated = { ...cur, [field]: val };
      if (field === 'check_in_time' && !val && ['Hadir', 'Telat', 'Belum Absen'].includes(cur.status)) {
        updated.status = 'Tidak Hadir';
      }
      return { ...p, [empId]: updated };
    });
  };

  const handleSave = async (emp) => {
    if (!date) {
      alert('Pilih tanggal terlebih dahulu.');
      return;
    }
    const d = edits[emp.id] || {};
    setSaving(p => ({ ...p, [emp.id]: true }));
    try {
      const res = await attendanceApi.upsertDaily(emp.id, date, d);
      if (res.success) {
        setSaved(p => ({ ...p, [emp.id]: res.data.status }));
        setRows(prev => prev.map(r => r.id === emp.id
          ? {
              ...r,
              ...res.data,
              id: emp.id,
              record_id: res.data.record_id ?? res.data.id ?? r.record_id,
            }
          : r
        ));
      } else {
        alert(res.message || 'Gagal menyimpan absensi.');
      }
    } catch (err) {
      alert(err.message || 'Gagal menyimpan absensi.');
    } finally {
      setSaving(p => ({ ...p, [emp.id]: false }));
    }
  };

  const filteredRows = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.name || '').toLowerCase().includes(q) || (r.branch_name || '').toLowerCase().includes(q) || (r.position || '').toLowerCase().includes(q);
  });

  // Split: belum diisi (no record) vs sudah diisi (has record)
  const belumRows = filteredRows.filter(r => !r.record_id && !saved[r.id]);
  const sudahRows = filteredRows.filter(r => r.record_id || saved[r.id]);

  const hadir = sudahRows.filter(r => (saved[r.id] || r.status) === 'Hadir').length;
  const telat = sudahRows.filter(r => (saved[r.id] || r.status) === 'Telat').length;
  const absen = sudahRows.filter(r => (saved[r.id] || r.status) === 'Tidak Hadir').length;

  const renderRow = (emp) => {
    const e = edits[emp.id] || {};
    const savedStatus = saved[emp.id];
    const isSaving = !!saving[emp.id];
    const isBelum = !emp.record_id && !savedStatus;

    let previewStatus = e.status || 'Tidak Hadir';
    if (e.check_in_time) {
      const cutoff = e.shift === 'Siang' ? cutoffs.siang : cutoffs.pagi;
      previewStatus = e.check_in_time > cutoff ? 'Telat' : 'Hadir';
    }

    return (
      <tr key={emp.id} style={{
        background: isBelum ? 'rgba(245,158,11,0.04)' : 'rgba(16,185,129,0.03)',
        borderLeft: isBelum ? '3px solid rgba(245,158,11,0.4)' : '3px solid rgba(16,185,129,0.3)',
      }}>
        <td>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 600 }}>{emp.employee_type}</span>
            {' '}{emp.position || ''}
          </div>
        </td>
        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{emp.branch_name || '—'}</td>
        <td>
          <select
            style={{ ...inputS, width: '90px', padding: '5px 8px' }}
            value={e.shift || 'Pagi'}
            onChange={ev => set(emp.id, 'shift', ev.target.value)}
          >
            <option value="Pagi">Pagi</option>
            <option value="Siang">Siang</option>
          </select>
        </td>
        <td>
          <input
            type="time"
            style={{ ...inputS, width: '100px', padding: '5px 8px' }}
            value={e.check_in_time || ''}
            onChange={ev => set(emp.id, 'check_in_time', ev.target.value)}
          />
        </td>
        <td>
          {e.check_in_time ? (
            <StatusBadge status={previewStatus} />
          ) : (
            <select
              style={{ ...inputS, width: '120px', padding: '5px 8px' }}
              value={e.status || 'Tidak Hadir'}
              onChange={ev => set(emp.id, 'status', ev.target.value)}
            >
              <option value="Tidak Hadir">Tidak Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Cuti">Cuti</option>
            </select>
          )}
        </td>
        <td>
          <input
            type="text"
            placeholder="Catatan (opsional)"
            style={{ ...inputS, width: '100%' }}
            value={e.notes || ''}
            onChange={ev => set(emp.id, 'notes', ev.target.value)}
          />
        </td>
        <td style={{ textAlign: 'center' }}>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(emp)}
            style={{
              background: savedStatus ? 'rgba(16,185,129,0.15)' : isBelum ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)',
              border: `1px solid ${savedStatus ? 'rgba(16,185,129,0.3)' : isBelum ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}`,
              color: savedStatus ? '#10b981' : isBelum ? '#f59e0b' : 'var(--color-primary)',
              padding: '6px 14px', borderRadius: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>
            {isSaving ? '...' : savedStatus ? '✓ Tersimpan' : (emp.record_id ? 'Update' : 'Simpan')}
          </button>
        </td>
      </tr>
    );
  };

  const theadRow = (
    <tr>
      <th style={{ minWidth: '160px' }}>Karyawan</th>
      <th>Cabang</th>
      <th style={{ width: '100px' }}>Shift</th>
      <th style={{ width: '110px' }}>Jam Masuk</th>
      <th style={{ width: '130px' }}>Status</th>
      <th style={{ width: '180px' }}>Keterangan</th>
      <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
    </tr>
  );

  return (
    <div>
      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Tanggal</label>
          <input type="date" style={{ ...inputS, width: '180px', maxWidth: '100%', padding: '9px 12px' }} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cabang</label>
          <select style={{ ...inputS, width: '200px', maxWidth: '100%', padding: '9px 13px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cari Karyawan</label>
          <input
            type="text"
            placeholder="Ketik nama atau cabang..."
            style={{ ...inputS, width: '210px', maxWidth: '100%', padding: '9px 12px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', paddingBottom: '2px' }}>
          <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 700 }}>{belumRows.length} belum diisi</span>
          <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>{hadir} Hadir</span>
          <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>{telat} Telat</span>
          <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>{absen} Absen</span>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.35)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>⚠ {error}</span>
          <button type="button" onClick={fetchRows} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>Coba Lagi</button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data...
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Tidak ada karyawan aktif. Tambah karyawan di menu Data Karyawan.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Tidak ada karyawan yang cocok dengan pencarian &quot;{search}&quot;.
        </div>
      ) : (
        <>
          {/* ── Belum Diisi ── */}
          {belumRows.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: '16px', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div style={{
                padding: '10px 20px', borderBottom: '1px solid rgba(245,158,11,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(245,158,11,0.06)', borderRadius: '12px 12px 0 0',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                  ● Belum Diisi
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  — {belumRows.length} karyawan perlu diisi absensinya
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>{theadRow}</thead>
                  <tbody>{belumRows.map(renderRow)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Sudah Diisi ── */}
          {sudahRows.length > 0 && (
            <div className="glass-panel" style={{ border: '1px solid rgba(16,185,129,0.2)', opacity: belumRows.length > 0 ? 0.85 : 1 }}>
              <div style={{
                padding: '10px 20px', borderBottom: '1px solid rgba(16,185,129,0.15)',
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(16,185,129,0.05)', borderRadius: '12px 12px 0 0',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>
                  ✓ Sudah Diisi
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  — {sudahRows.length} karyawan
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>{theadRow}</thead>
                  <tbody>{sudahRows.map(renderRow)}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Shift cutoff info */}
      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Batas masuk: <strong>Shift Pagi {cutoffs.pagi}</strong> · <strong>Shift Siang {cutoffs.siang}</strong>. Status Hadir/Telat dihitung otomatis dari jam masuk.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab 2: Rekap Bulanan
// ──────────────────────────────────────────────────────────────────────────────

const DAY_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_ID[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function DetailModal({ emp, period, onClose }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    attendanceApi.getEmployeeDailyDetail(emp.id, period)
      .then(res => {
        if (!active) return;
        if (res.success) setDetails(res.data || []);
        else setError(res.message || 'Gagal memuat detail absensi.');
      })
      .catch(err => {
        if (active) setError(err.message || 'Gagal memuat detail absensi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [emp.id, period]);

  const ringkasan = {
    hadir: details.filter(d => d.status === 'Hadir').length,
    telat: details.filter(d => d.status === 'Telat').length,
    absen: details.filter(d => d.status === 'Tidak Hadir').length,
    izin: details.filter(d => d.status === 'Izin').length,
    sakit: details.filter(d => d.status === 'Sakit').length,
    cuti: details.filter(d => d.status === 'Cuti').length,
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backdropFilter: 'blur(4px)', overscrollBehavior: 'contain',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-surface-opaque)', borderRadius: '16px',
        width: '100%', maxWidth: '600px', maxHeight: '82vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</h3>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                {emp.branch_name || 'Tanpa Cabang'} · Periode {period}
              </p>
            </div>
            <button type="button" onClick={onClose} style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-color)',
              color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer',
              padding: '4px 10px', borderRadius: '8px', fontFamily: 'inherit', lineHeight: 1.5,
            }}>✕</button>
          </div>

          {/* Mini ringkasan */}
          {!loading && !error && details.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
              {[
                ['Hadir', ringkasan.hadir, '#10b981'],
                ['Telat', ringkasan.telat, '#f59e0b'],
                ['Tdk Hadir', ringkasan.absen, '#ef4444'],
                ['Izin', ringkasan.izin, '#6366f1'],
                ['Sakit', ringkasan.sakit, '#3b82f6'],
                ['Cuti', ringkasan.cuti, '#14b8a6'],
              ].map(([lbl, val, clr]) => (
                <div key={lbl} style={{
                  background: `${clr}18`, border: `1px solid ${clr}30`,
                  borderRadius: '8px', padding: '6px 12px', textAlign: 'center', minWidth: '64px',
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: clr }}>{val}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{lbl}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />Memuat data...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-danger)' }}>
              ⚠ {error}
            </div>
          ) : details.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              Belum ada catatan absensi untuk periode ini.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Shift</th>
                  <th style={{ textAlign: 'center' }}>Jam Masuk</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {details.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDate(d.date)}</td>
                    <td>
                      <span style={{
                        background: d.shift === 'Siang' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                        color: d.shift === 'Siang' ? '#f59e0b' : '#6366f1',
                        padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                      }}>{d.shift || '—'}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', color: d.check_in_time ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {d.check_in_time || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={d.status} /></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function RekapBulanan({ branches }) {
  const [period, setPeriod] = useState(currentPeriod);
  const [branchId, setBranchId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [kasbonEdits, setKasbonEdits] = useState({});
  const [kasbonSaving, setKasbonSaving] = useState({});
  const [kasbonSaved, setKasbonSaved] = useState({});
  const [detailEmp, setDetailEmp] = useState(null);
  const timersRef = useRef({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError('');
    setKasbonSaved({});
    try {
      const params = { period };
      if (branchId) params.branch_id = branchId;
      const res = await attendanceApi.getMonthlySummary(params);
      if (res.success) {
        setRows(res.data || []);
        const init = {};
        for (const r of (res.data || [])) {
          init[r.id] = {
            cash_advance: String(r.cash_advance ?? 0),
            fake_money: String(r.fake_money ?? 0),
          };
        }
        setKasbonEdits(init);
      } else {
        setError(res.message || 'Gagal memuat rekap absensi.');
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat rekap absensi.');
    } finally {
      setLoading(false);
    }
  }, [period, branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSyncPeriod = async () => {
    setSyncing(true);
    try {
      const res = await attendanceApi.syncPeriod(period);
      if (res.success) {
        alert(res.message);
        fetchData();
      } else {
        alert(res.message || 'Gagal sinkronisasi.');
      }
    } catch (err) { alert(err.message || 'Gagal sinkronisasi.'); }
    setSyncing(false);
  };

  const handleSaveKasbon = async (emp) => {
    const d = kasbonEdits[emp.id] || {};
    const payload = {
      cash_advance: parseFloat(d.cash_advance) || 0,
      fake_money: parseFloat(d.fake_money) || 0,
    };
    setKasbonSaving(p => ({ ...p, [emp.id]: true }));
    try {
      const res = await attendanceApi.upsertRecord(emp.id, period, payload);
      if (res.success) {
        setRows(prev => prev.map(r => r.id === emp.id
          ? { ...r, ...(res.data || {}), cash_advance: payload.cash_advance, fake_money: payload.fake_money, id: emp.id }
          : r
        ));
        setKasbonSaved(p => ({ ...p, [emp.id]: true }));
        if (timersRef.current[emp.id]) clearTimeout(timersRef.current[emp.id]);
        timersRef.current[emp.id] = setTimeout(() => {
          setKasbonSaved(p => { const n = { ...p }; delete n[emp.id]; return n; });
        }, 2500);
      } else {
        alert(res.message || 'Gagal menyimpan kasbon.');
      }
    } catch (err) {
      alert(err.message || 'Gagal menyimpan kasbon.');
    } finally {
      setKasbonSaving(p => ({ ...p, [emp.id]: false }));
    }
  };

  const setKasbon = (empId, field, val) => {
    setKasbonSaved(p => {
      if (!p[empId]) return p;
      const n = { ...p };
      delete n[empId];
      return n;
    });
    setKasbonEdits(p => ({ ...p, [empId]: { ...p[empId], [field]: val } }));
  };

  const totalHadir = rows.reduce((s, r) => s + (r.days_hadir || 0), 0);
  const totalTelat = rows.reduce((s, r) => s + (r.days_telat || 0), 0);
  const totalAbsen = rows.reduce((s, r) => s + (r.days_tidak_hadir || 0), 0);
  const totalAsben = rows.reduce((s, r) => s + (r.asben_contribution || 0), 0);

  return (
    <div>
      {/* Filters + Sync */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Periode</label>
          <select style={{ ...inputS, width: '160px', maxWidth: '100%', padding: '9px 13px' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {periodOptions().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cabang</label>
          <select style={{ ...inputS, width: '200px', maxWidth: '100%', padding: '9px 13px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncPeriod}
          style={{
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            color: 'var(--color-primary)', padding: '9px 18px', borderRadius: '8px',
            cursor: syncing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
          }}>
          {syncing ? 'Sinkronisasi...' : '⟳ Sinkron ke Payroll'}
        </button>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingBottom: '2px', marginLeft: '4px' }}>
          {[['Total Hadir', '#10b981', totalHadir + ' hari'], ['Total Telat', '#f59e0b', totalTelat + ' kali'], ['Total Absen', '#ef4444', totalAbsen + ' hari'], ['Total ASBEN', '#10b981', 'Rp ' + fmt(totalAsben)]].map(([lbl, clr, val]) => (
            <div key={lbl} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {lbl}: <span style={{ color: clr, fontWeight: 700 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.35)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>⚠ {error}</span>
          <button type="button" onClick={fetchData} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>Coba Lagi</button>
        </div>
      )}

      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat rekap...
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Tidak ada karyawan aktif.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>Karyawan</th>
                  <th>Cabang</th>
                  <th style={{ textAlign: 'center' }}>Hadir</th>
                  <th style={{ textAlign: 'center' }}>Telat</th>
                  <th style={{ textAlign: 'center' }}>Tdk Hadir</th>
                  <th style={{ textAlign: 'center' }}>Izin</th>
                  <th style={{ textAlign: 'center' }}>Sakit</th>
                  <th style={{ textAlign: 'center' }}>Cuti</th>
                  <th style={{ textAlign: 'right', color: '#f59e0b' }}>Pot. Absen</th>
                  <th style={{ textAlign: 'right', color: '#ef4444' }}>ASBEN</th>
                  <th style={{ textAlign: 'right' }}>Kasbon (Rp)</th>
                  <th style={{ textAlign: 'right' }}>Uang Palsu (Rp)</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Simpan</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => {
                  const ke = kasbonEdits[emp.id] || {};
                  const isSaved = !!kasbonSaved[emp.id];
                  const isSaving = !!kasbonSaving[emp.id];
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.position || emp.employee_type}</div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{emp.branch_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>{emp.days_hadir || 0}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#f59e0b', fontWeight: emp.days_telat > 0 ? 700 : 400 }}>{emp.days_telat || 0}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: emp.days_tidak_hadir > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: emp.days_tidak_hadir > 0 ? 700 : 400 }}>{emp.days_tidak_hadir || 0}</span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#6366f1' }}>{emp.days_izin || 0}</td>
                      <td style={{ textAlign: 'center', color: '#3b82f6' }}>{emp.days_sakit || 0}</td>
                      <td style={{ textAlign: 'center', color: '#14b8a6' }}>{emp.days_cuti || 0}</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>
                        {emp.deduction_absent != null ? `Rp ${fmt(emp.deduction_absent)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                        {emp.asben_contribution != null ? `Rp ${fmt(emp.asben_contribution)}` : '—'}
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="1000"
                          style={{ ...inputS, width: '100%', textAlign: 'right' }}
                          value={ke.cash_advance ?? '0'}
                          onChange={e => setKasbon(emp.id, 'cash_advance', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="1000"
                          style={{ ...inputS, width: '100%', textAlign: 'right' }}
                          value={ke.fake_money ?? '0'}
                          onChange={e => setKasbon(emp.id, 'fake_money', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveKasbon(emp)}
                          style={{
                            background: isSaved ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
                            border: `1px solid ${isSaved ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`,
                            color: isSaved ? '#10b981' : 'var(--color-primary)',
                            padding: '5px 12px', borderRadius: '8px',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                          }}>
                          {isSaving ? '...' : isSaved ? '✓' : 'Simpan'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setDetailEmp(emp)}
                          style={{
                            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                            color: '#3b82f6', padding: '5px 12px', borderRadius: '8px',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                          }}>Detail</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Klik <strong>⟳ Sinkron ke Payroll</strong> untuk memperbarui data potongan di modul penggajian. Kasbon dan uang palsu disimpan terpisah.
      </div>

      {detailEmp && (
        <DetailModal emp={detailEmp} period={period} onClose={() => setDetailEmp(null)} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'harian', label: 'Input Harian' },
  { id: 'bulanan', label: 'Rekap Bulanan' },
];

export default function AttendanceManagement() {
  const [activeTab, setActiveTab] = useState('harian');
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    branchApi.getAll()
      .then(r => {
        if (r.success) setBranches(r.data.filter(b => b.status === 'Active'));
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Absensi Karyawan</h1>
          <p className="page-subtitle">Input dan rekap absensi harian karyawan per shift.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-input)', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button
            type="button"
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
              background: activeTab === t.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'harian' && <InputHarian branches={branches} />}
      {activeTab === 'bulanan' && <RekapBulanan branches={branches} />}
    </div>
  );
}
