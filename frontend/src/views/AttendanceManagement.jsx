import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, branchApi } from '../services/api';

const fmt = (n) => n != null ? new Intl.NumberFormat('id-ID').format(n) : '0';

const STATUS_COLORS = {
  'Hadir':       { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
  'Telat':       { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'Tidak Hadir': { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  'Izin':        { bg: 'rgba(99,102,241,0.15)',  color: '#6366f1' },
  'Sakit':       { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setSaved({});
    try {
      const params = { date };
      if (branchId) params.branch_id = branchId;
      const res = await attendanceApi.getByDate(params);
      if (res.success) {
        setRows(res.data);
        const init = {};
        for (const r of res.data) {
          init[r.id] = {
            shift: r.shift || 'Pagi',
            check_in_time: r.check_in_time || '',
            status: r.status === 'Belum Absen' ? 'Tidak Hadir' : r.status,
            notes: r.notes || '',
          };
        }
        setEdits(init);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [date, branchId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const set = (empId, field, val) =>
    setEdits(p => ({ ...p, [empId]: { ...p[empId], [field]: val } }));

  const handleSave = async (emp) => {
    const d = edits[emp.id] || {};
    setSaving(p => ({ ...p, [emp.id]: true }));
    try {
      const res = await attendanceApi.upsertDaily(emp.id, date, d);
      if (res.success) {
        setSaved(p => ({ ...p, [emp.id]: res.data.status }));
        setRows(prev => prev.map(r => r.id === emp.id
          ? { ...r, ...res.data, record_id: res.data.id }
          : r
        ));
      } else {
        alert(res.message);
      }
    } catch (err) { alert(err.message); }
    setSaving(p => ({ ...p, [emp.id]: false }));
  };

  const hadir = rows.filter(r => saved[r.id] === 'Hadir' || (!saved[r.id] && r.status === 'Hadir')).length;
  const telat = rows.filter(r => saved[r.id] === 'Telat' || (!saved[r.id] && r.status === 'Telat')).length;
  const absen = rows.filter(r => saved[r.id] === 'Tidak Hadir' || (!saved[r.id] && r.status === 'Tidak Hadir')).length;
  const belum = rows.filter(r => !r.record_id && !saved[r.id]).length;

  return (
    <div>
      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Tanggal</label>
          <input type="date" style={{ ...inputS, width: '180px', padding: '9px 12px' }} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cabang</label>
          <select style={{ ...inputS, width: '200px', padding: '9px 13px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingBottom: '2px' }}>
          {[['Hadir', '#10b981', hadir], ['Telat', '#f59e0b', telat], ['Absen', '#ef4444', absen], ['Belum diisi', '#6b7280', belum]].map(([lbl, clr, val]) => (
            <span key={lbl} style={{ fontSize: '13px', color: clr, fontWeight: 600 }}>{val} {lbl}</span>
          ))}
        </div>
      </div>

      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data...
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Tidak ada karyawan aktif. Tambah karyawan di menu Data Karyawan.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>Karyawan</th>
                  <th>Cabang</th>
                  <th style={{ width: '100px' }}>Shift</th>
                  <th style={{ width: '110px' }}>Jam Masuk</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '180px' }}>Keterangan</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => {
                  const e = edits[emp.id] || {};
                  const savedStatus = saved[emp.id];
                  const isSaving = saving[emp.id];
                  const hasRecord = !!emp.record_id || !!savedStatus;

                  // Compute preview status
                  let previewStatus = e.status || 'Tidak Hadir';
                  if (e.check_in_time) {
                    const cutoff = e.shift === 'Siang' ? '14:30' : '06:30';
                    previewStatus = e.check_in_time > cutoff ? 'Telat' : 'Hadir';
                  }
                  const displayStatus = savedStatus || (hasRecord && !savedStatus ? emp.status : previewStatus);

                  return (
                    <tr key={emp.id} style={{ background: savedStatus ? 'rgba(16,185,129,0.03)' : undefined }}>
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
                          disabled={isSaving}
                          onClick={() => handleSave(emp)}
                          style={{
                            background: savedStatus ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
                            border: `1px solid ${savedStatus ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`,
                            color: savedStatus ? '#10b981' : 'var(--color-primary)',
                            padding: '6px 14px', borderRadius: '8px',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
                          }}>
                          {isSaving ? '...' : savedStatus ? '✓ Tersimpan' : (emp.record_id ? 'Update' : 'Simpan')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shift cutoff info */}
      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Batas masuk: <strong>Shift Pagi 06:30</strong> · <strong>Shift Siang 14:30</strong>. Status Hadir/Telat dihitung otomatis dari jam masuk.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab 2: Rekap Bulanan
// ──────────────────────────────────────────────────────────────────────────────

function DetailModal({ emp, period, onClose }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.getEmployeeDailyDetail(emp.id, period).then(res => {
      if (res.success) setDetails(res.data);
      setLoading(false);
    });
  }, [emp.id, period]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '640px', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Detail Absensi — {emp.name}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Periode {period} · {emp.branch_name || '—'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat...</div>
        ) : details.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Belum ada data absensi untuk periode ini.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Shift</th>
                <th>Jam Masuk</th>
                <th>Status</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {details.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.date}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{d.shift || '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{d.check_in_time || '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RekapBulanan({ branches }) {
  const [period, setPeriod] = useState(currentPeriod);
  const [branchId, setBranchId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [kasbonEdits, setKasbonEdits] = useState({});
  const [kasbonSaving, setKasbonSaving] = useState({});
  const [kasbonSaved, setKasbonSaved] = useState({});
  const [detailEmp, setDetailEmp] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setKasbonSaved({});
    try {
      const params = { period };
      if (branchId) params.branch_id = branchId;
      const res = await attendanceApi.getMonthlySummary(params);
      if (res.success) {
        setRows(res.data);
        const init = {};
        for (const r of res.data) {
          init[r.id] = {
            cash_advance: r.cash_advance ?? 0,
            fake_money: r.fake_money ?? 0,
          };
        }
        setKasbonEdits(init);
      }
    } catch { /* silent */ }
    setLoading(false);
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
        alert(res.message);
      }
    } catch (err) { alert(err.message); }
    setSyncing(false);
  };

  const handleSaveKasbon = async (emp) => {
    const d = kasbonEdits[emp.id] || {};
    setKasbonSaving(p => ({ ...p, [emp.id]: true }));
    try {
      const res = await attendanceApi.upsertRecord(emp.id, period, d);
      if (res.success) {
        setKasbonSaved(p => ({ ...p, [emp.id]: true }));
        setTimeout(() => setKasbonSaved(p => { const n = { ...p }; delete n[emp.id]; return n; }), 2500);
      } else {
        alert(res.message);
      }
    } catch (err) { alert(err.message); }
    setKasbonSaving(p => ({ ...p, [emp.id]: false }));
  };

  const setKasbon = (empId, field, val) =>
    setKasbonEdits(p => ({ ...p, [empId]: { ...p[empId], [field]: val } }));

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
          <select style={{ ...inputS, width: '160px', padding: '9px 13px' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {periodOptions().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cabang</label>
          <select style={{ ...inputS, width: '200px', padding: '9px 13px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button
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
                          value={ke.cash_advance ?? 0}
                          onChange={e => setKasbon(emp.id, 'cash_advance', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="1000"
                          style={{ ...inputS, width: '100%', textAlign: 'right' }}
                          value={ke.fake_money ?? 0}
                          onChange={e => setKasbon(emp.id, 'fake_money', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
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
    branchApi.getAll().then(r => {
      if (r.success) setBranches(r.data.filter(b => b.status === 'Active'));
    });
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
