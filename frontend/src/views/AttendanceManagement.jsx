import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, branchApi } from '../services/api';

const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(n) : '0';

const inputS = {
  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
  padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px',
  width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', textAlign: 'right',
};

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function MoneyInput({ value, onChange }) {
  return (
    <input type="number" min="0" step="1000" style={inputS} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
  );
}

function NumInput({ value, onChange, max = 31 }) {
  return (
    <input type="number" min="0" max={max} step="1" style={{ ...inputS, width: '64px' }} value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} />
  );
}

export default function AttendanceManagement() {
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [edits, setEdits] = useState({});
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    branchApi.getAll().then(r => { if (r.success) setBranches(r.data.filter(b => b.status === 'Active')); });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSavedIds(new Set());
    setEdits({});
    try {
      const params = { period };
      if (branchId) params.branch_id = branchId;
      const [attRes, sumRes] = await Promise.all([
        attendanceApi.getByPeriod(params),
        attendanceApi.summary(params),
      ]);
      if (attRes.success) {
        setRows(attRes.data);
        const init = {};
        for (const r of attRes.data) {
          init[r.id] = {
            days_absent: r.days_absent ?? 0,
            late_count: r.late_count ?? 0,
            cash_advance: r.cash_advance ?? 0,
            fake_money: r.fake_money ?? 0,
          };
        }
        setEdits(init);
      }
      if (sumRes.success) setSummary(sumRes.data.filter(s => s.recorded > 0 || s.total_asben > 0));
    } catch { /* silent */ }
    setLoading(false);
  }, [period, branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (employeeId, field, val) => {
    setEdits(p => ({ ...p, [employeeId]: { ...p[employeeId], [field]: val } }));
  };

  const handleSave = async (emp) => {
    const data = edits[emp.id] || {};
    setSavingId(emp.id);
    try {
      const res = await attendanceApi.upsert(emp.id, period, data);
      if (res.success) {
        setSavedIds(p => new Set([...p, emp.id]));
        setRows(prev => prev.map(r => r.id === emp.id ? {
          ...r,
          days_absent: res.data.days_absent,
          late_count: res.data.late_count,
          cash_advance: res.data.cash_advance,
          fake_money: res.data.fake_money,
          deduction_absent: res.data.deduction_absent,
          deduction_late: res.data.deduction_late,
          asben_contribution: res.data.asben_contribution,
          record_id: res.data.id,
        } : r));
        const [sumRes] = await Promise.all([attendanceApi.summary({ period, ...(branchId ? { branch_id: branchId } : {}) })]);
        if (sumRes.success) setSummary(sumRes.data.filter(s => s.recorded > 0 || s.total_asben > 0));
      } else {
        alert(res.message);
      }
    } catch (err) { alert(err.message); }
    setSavingId(null);
  };

  const periodOptions = () => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push(val);
    }
    return opts;
  };

  const totalAsben = summary.reduce((s, r) => s + (r.total_asben || 0), 0);
  const totalKasbon = summary.reduce((s, r) => s + (r.total_kasbon || 0), 0);
  const recorded = rows.filter(r => r.record_id).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Absensi Karyawan</h1>
          <p className="page-subtitle">Input rekap absensi per periode penggajian untuk setiap karyawan.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Periode</label>
          <select style={{ ...inputS, textAlign: 'left', width: '160px', padding: '9px 13px' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {periodOptions().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cabang</label>
          <select style={{ ...inputS, textAlign: 'left', width: '200px', padding: '9px 13px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ marginTop: '18px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {recorded} / {rows.length} karyawan sudah diisi
          </span>
        </div>
      </div>

      {/* ASBEN Summary Cards */}
      {summary.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total ASBEN Periode', value: `Rp ${fmt(totalAsben)}`, color: '#10b981', desc: 'Masuk sbg pendapatan cabang' },
            { label: 'Total Kasbon Dipotong', value: `Rp ${fmt(totalKasbon)}`, color: '#f59e0b', desc: 'Dipotong dari gaji karyawan' },
          ].map(c => (
            <div key={c.label} className="glass-panel stat-card" style={{ borderColor: `${c.color}40` }}>
              <div className="stat-card-title">{c.label}</div>
              <div className="stat-card-value" style={{ color: c.color, fontSize: '18px' }}>{c.value}</div>
              <div className="stat-card-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data absensi...
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Tidak ada karyawan aktif ditemukan</p>
            <p style={{ fontSize: '13px' }}>Tambah karyawan di menu Data Karyawan terlebih dahulu.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '160px' }}>Karyawan</th>
                  <th>Cabang</th>
                  <th style={{ textAlign: 'center' }}>Hari Tidak Masuk</th>
                  <th style={{ textAlign: 'center' }}>Terlambat (kali)</th>
                  <th style={{ textAlign: 'right' }}>Kasbon (Rp)</th>
                  <th style={{ textAlign: 'right' }}>Uang Palsu (Rp)</th>
                  <th style={{ textAlign: 'right', color: '#f59e0b' }}>Pot. Absen</th>
                  <th style={{ textAlign: 'right', color: '#ef4444' }}>Pot. Telat / ASBEN</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => {
                  const d = edits[emp.id] || {};
                  const isSaved = savedIds.has(emp.id);
                  const isSaving = savingId === emp.id;
                  return (
                    <tr key={emp.id} style={{ background: isSaved ? 'rgba(16,185,129,0.04)' : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span style={{ background: emp.employee_type === 'Staff' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: emp.employee_type === 'Staff' ? '#8b5cf6' : '#3b82f6', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 600 }}>{emp.employee_type}</span>
                          {' '}{emp.position || ''}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{emp.branch_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <NumInput value={d.days_absent ?? 0} onChange={v => setField(emp.id, 'days_absent', v)} max={31} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <NumInput value={d.late_count ?? 0} onChange={v => setField(emp.id, 'late_count', v)} max={31} />
                      </td>
                      <td>
                        <MoneyInput value={d.cash_advance ?? 0} onChange={v => setField(emp.id, 'cash_advance', v)} />
                      </td>
                      <td>
                        <MoneyInput value={d.fake_money ?? 0} onChange={v => setField(emp.id, 'fake_money', v)} />
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>
                        {emp.deduction_absent != null ? `Rp ${fmt(emp.deduction_absent)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>
                        {emp.deduction_late != null ? `Rp ${fmt(emp.deduction_late)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          disabled={isSaving}
                          onClick={() => handleSave(emp)}
                          style={{
                            background: isSaved ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
                            border: `1px solid ${isSaved ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`,
                            color: isSaved ? '#10b981' : 'var(--color-primary)',
                            padding: '6px 14px', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer',
                            fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
                          }}>
                          {isSaving ? '...' : isSaved ? '✓ Tersimpan' : 'Simpan'}
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

      {/* Branch Summary */}
      {summary.length > 0 && (
        <div className="glass-panel" style={{ marginTop: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Rekap ASBEN per Cabang — {period}</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cabang</th>
                  <th style={{ textAlign: 'center' }}>Sudah Diisi</th>
                  <th style={{ textAlign: 'right' }}>Total Hari Absen</th>
                  <th style={{ textAlign: 'right' }}>Potongan Absen</th>
                  <th style={{ textAlign: 'right' }}>Potongan Telat</th>
                  <th style={{ textAlign: 'right' }}>Total ASBEN</th>
                  <th style={{ textAlign: 'right' }}>Total Kasbon</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(s => (
                  <tr key={s.branch_id}>
                    <td style={{ fontWeight: 600 }}>{s.branch_name || 'Tanpa Cabang'}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{s.recorded}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{s.total_absent_days}</td>
                    <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>Rp {fmt(s.total_absent_deduction)}</td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>Rp {fmt(s.total_late_deduction)}</td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>Rp {fmt(s.total_asben)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Rp {fmt(s.total_kasbon)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
