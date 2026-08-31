import React, { useState, useEffect, useCallback, useRef } from 'react';
import { payrollApi, branchApi } from '../services/api';

const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(Math.round(n)) : '0';
const fmtRp = (n) => `Rp ${fmt(n)}`;

const inputS = {
  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
  padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px',
  width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', textAlign: 'right',
};

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

// ─── Slip Modal ──────────────────────────────────────────────────────────────
function SlipModal({ slip, onClose }) {
  const printRef = useRef();
  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Slip Gaji — ${slip.employee_name}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; color: #000; }
        h2 { margin: 0 0 4px; font-size: 15px; } p { margin: 2px 0; }
        .divider { border-top: 1px dashed #333; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .row .label { flex: 1; }
        .row .amount { min-width: 130px; text-align: right; }
        .bold { font-weight: bold; }
        .total { background: #f0f0f0; padding: 4px 0; }
      </style></head>
      <body>${printRef.current.innerHTML}</body></html>
    `);
    w.document.close();
    w.print();
  };

  const gross = (slip.salary || 0) + (slip.allowance || 0);
  const totalBonus = (slip.bonus_penjualan || 0) + (slip.bonus_tartun || 0) + (slip.bonus_lain || 0);
  const totalPotongan = (slip.deduction_kasbon || 0) + (slip.deduction_absent || 0) + (slip.deduction_late || 0) + (slip.deduction_fake_money || 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(6px)', padding: '24px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Slip Gaji</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handlePrint} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit' }}>🖨 Cetak</button>
            <button onClick={onClose} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        <div style={{ padding: '20px 24px', fontFamily: 'monospace', fontSize: '13px' }} ref={printRef}>
          <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
            <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>CV. ASYA BISNIS INDONESIA</strong>
            <p style={{ margin: '2px 0', fontSize: '11px', color: 'var(--text-muted)' }}>SLIP GAJI KARYAWAN</p>
            <p style={{ margin: '2px 0', fontSize: '11px', color: 'var(--text-muted)' }}>{slip.period_label}</p>
          </div>
          <div style={{ marginBottom: '10px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
            <Row label="Nama" value={slip.employee_name} />
            <Row label="Jabatan" value={slip.position || '—'} />
            <Row label="Lokasi" value={slip.branch_name || '—'} />
          </div>
          <p style={{ margin: '4px 0 6px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Penghasilan</p>
          <Row label="Gaji Pokok" value={fmtRp(slip.salary)} />
          <Row label="Tunjangan" value={fmtRp(slip.allowance)} />
          <RowTotal label="TOTAL PENGHASILAN" value={fmtRp(gross)} />

          {(slip.bonus_penjualan > 0 || slip.bonus_tartun > 0 || slip.bonus_lain > 0) && <>
            <p style={{ margin: '8px 0 6px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Bonus</p>
            {slip.bonus_penjualan > 0 && <Row label="Bonus Penjualan" value={fmtRp(slip.bonus_penjualan)} />}
            {slip.bonus_tartun > 0 && <Row label="Bonus Tartun" value={fmtRp(slip.bonus_tartun)} />}
            {slip.bonus_lain > 0 && <Row label={slip.bonus_lain_label || 'Bonus Lain'} value={fmtRp(slip.bonus_lain)} />}
            <RowTotal label="TOTAL BONUS" value={fmtRp(totalBonus)} />
          </>}

          <p style={{ margin: '8px 0 6px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Potongan</p>
          {slip.deduction_kasbon > 0 && <Row label="Kasbon" value={`(${fmtRp(slip.deduction_kasbon)})`} red />}
          {slip.deduction_absent > 0 && <Row label="Tidak Masuk" value={`(${fmtRp(slip.deduction_absent)})`} red />}
          {slip.deduction_late > 0 && <Row label="Terlambat" value={`(${fmtRp(slip.deduction_late)})`} red />}
          {slip.deduction_fake_money > 0 && <Row label="Uang Palsu" value={`(${fmtRp(slip.deduction_fake_money)})`} red />}
          {totalPotongan === 0 && <Row label="—" value="Rp 0" />}
          <RowTotal label="TOTAL POTONGAN" value={`(${fmtRp(totalPotongan)})`} red />

          <div style={{ marginTop: '10px', borderTop: '2px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>TAKE HOME PAY</strong>
            <strong style={{ fontSize: '16px', color: '#10b981' }}>{fmtRp(slip.take_home_pay)}</strong>
          </div>
          {slip.notes && <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Catatan: {slip.notes}</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, red }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: red ? '#ef4444' : 'var(--text-secondary)', fontSize: '13px' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
function RowTotal({ label, value, red }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: red ? '#ef4444' : 'var(--text-primary)', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '2px', marginBottom: '4px' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

// ─── Bonus Edit Modal ─────────────────────────────────────────────────────────
function BonusModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState({
    bonus_penjualan: entry.bonus_penjualan || 0,
    bonus_tartun: entry.bonus_tartun || 0,
    bonus_lain: entry.bonus_lain || 0,
    bonus_lain_label: entry.bonus_lain_label || '',
    bonus_ditahan: entry.bonus_ditahan || 0,
    notes: entry.notes || '',
  });
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const fNum = k => e => setForm(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }));

  const labelS = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(6px)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Input Bonus & Catatan</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{entry.employee_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: 'Bonus Penjualan (Rp)', key: 'bonus_penjualan' },
            { label: 'Bonus Tartun / Tarik Tunai (Rp)', key: 'bonus_tartun' },
            { label: 'Bonus Lain (Rp)', key: 'bonus_lain' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label style={labelS}>{label}</label>
              <input type="number" min="0" step="1000" style={{ ...inputS, textAlign: 'left' }} value={form[key]} onChange={fNum(key)} />
            </div>
          ))}
          <div>
            <label style={labelS}>Label Bonus Lain</label>
            <input style={{ ...inputS, textAlign: 'left' }} placeholder="Contoh: Bonus Lebaran" value={form.bonus_lain_label} onChange={f('bonus_lain_label')} />
          </div>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px' }}>
            <label style={{ ...labelS, color: '#f59e0b' }}>Bonus Ditahan (Rp) — tidak masuk slip</label>
            <input type="number" min="0" step="1000" style={{ ...inputS, textAlign: 'left' }} value={form.bonus_ditahan} onChange={fNum('bonus_ditahan')} />
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Dicatat sbg komponen laporan keuangan cabang, tidak masuk THP.</p>
          </div>
          <div>
            <label style={labelS}>Catatan</label>
            <textarea style={{ ...inputS, textAlign: 'left', minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '14px' }}>Batal</button>
          <button onClick={() => onSave(form)} style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px' }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PayrollManagement() {
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [employeeType, setEmployeeType] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [entries, setEntries] = useState([]);
  const [periodInfo, setPeriodInfo] = useState(null);
  const [summary, setSummary] = useState({ data: [], grand_total: 0 });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('entries');
  const [slipData, setSlipData] = useState(null);
  const [bonusEntry, setBonusEntry] = useState(null);

  useEffect(() => {
    branchApi.getAll().then(r => { if (r.success) setBranches(r.data.filter(b => b.status === 'Active')); });
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (employeeType) params.employee_type = employeeType;
      if (branchId) params.branch_id = branchId;
      const [entRes, sumRes] = await Promise.all([
        payrollApi.getEntries(period, params),
        payrollApi.getSummary(period),
      ]);
      if (entRes.success) { setEntries(entRes.data); setPeriodInfo(entRes.period_info); }
      if (sumRes.success) setSummary({ data: sumRes.data, grand_total: sumRes.grand_total, period_info: sumRes.period_info });
    } catch { /* silent */ }
    setLoading(false);
  }, [period, employeeType, branchId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleGenerate = async () => {
    if (!window.confirm(`Generate/refresh payroll untuk periode ${period}?\n\nData bonus yang sudah diinput tidak akan terhapus.`)) return;
    setGenerating(true);
    try {
      const res = await payrollApi.generateEntries(period);
      if (res.success) { alert(res.message); fetchAll(); }
      else alert(res.message);
    } catch (err) { alert(err.message); }
    setGenerating(false);
  };

  const openSlip = async (entry) => {
    const res = await payrollApi.getSlip(entry.id);
    if (res.success) setSlipData(res.data);
    else alert(res.message);
  };

  const handleBonusSave = async (form) => {
    const res = await payrollApi.updateEntry(bonusEntry.id, form);
    if (res.success) {
      setEntries(prev => prev.map(e => e.id === bonusEntry.id ? { ...e, ...res.data } : e));
      setBonusEntry(null);
      fetchAll();
    } else alert(res.message);
  };

  const totalGross = entries.reduce((s, e) => s + (e.salary || 0) + (e.allowance || 0), 0);
  const totalBonus = entries.reduce((s, e) => s + (e.bonus_penjualan || 0) + (e.bonus_tartun || 0) + (e.bonus_lain || 0), 0);
  const totalPot = entries.reduce((s, e) => s + (e.deduction_kasbon || 0) + (e.deduction_absent || 0) + (e.deduction_late || 0) + (e.deduction_fake_money || 0), 0);
  const totalTHP = entries.reduce((s, e) => s + (e.take_home_pay || 0), 0);

  const statusBadge = (status) => {
    const m = { Draft: ['rgba(107,114,128,0.15)', '#9ca3af'], Submitted: ['rgba(245,158,11,0.15)', '#f59e0b'], Approved: ['rgba(16,185,129,0.15)', '#10b981'], Rejected: ['rgba(239,68,68,0.15)', '#ef4444'] };
    const [bg, color] = m[status] || m.Draft;
    return <span style={{ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Payroll</h1>
          <p className="page-subtitle">
            {periodInfo ? periodInfo.label : 'Input bonus, hitung THP, dan cetak slip gaji karyawan.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {periodInfo && statusBadge(periodInfo.status)}
          <button onClick={handleGenerate} disabled={generating || periodInfo?.status !== 'Draft' && periodInfo}
            style={{ background: generating ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '10px 16px', borderRadius: '10px', cursor: (generating || (periodInfo?.status !== 'Draft' && periodInfo)) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit' }}>
            {generating ? 'Generating...' : '⚡ Generate Payroll'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Periode</label>
          <select style={{ ...inputS, textAlign: 'left', width: '160px', padding: '9px 13px' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {periodOptions().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Tipe Karyawan</label>
          <select style={{ ...inputS, textAlign: 'left', width: '150px', padding: '9px 13px' }} value={employeeType} onChange={e => setEmployeeType(e.target.value)}>
            <option value="">Semua Tipe</option>
            <option value="Frontliner">Frontliner</option>
            <option value="Staff">Staff</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Cabang</label>
          <select style={{ ...inputS, textAlign: 'left', width: '200px', padding: '9px 13px' }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
        {[
          { label: 'Gaji + Tunjangan', value: fmtRp(totalGross), color: '#3b82f6' },
          { label: 'Total Bonus', value: fmtRp(totalBonus), color: '#10b981' },
          { label: 'Total Potongan', value: `(${fmtRp(totalPot)})`, color: '#ef4444' },
          { label: 'GRAND TOTAL THP', value: fmtRp(totalTHP), color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="glass-panel stat-card" style={{ borderColor: `${s.color}40` }}>
            <div className="stat-card-title">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color, fontSize: '14px' }}>{s.value}</div>
            <div className="stat-card-desc">{entries.length} karyawan</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        {[{ id: 'entries', label: 'Detail Karyawan' }, { id: 'rekap', label: 'Rekap per Cabang' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? 'var(--color-primary)' : 'var(--text-secondary)', borderBottom: `2px solid ${activeTab === t.id ? 'var(--color-primary)' : 'transparent'}`, marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Entries Tab */}
      {activeTab === 'entries' && (
        <div className="glass-panel">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data payroll...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>Belum ada data payroll untuk periode ini</p>
              <p style={{ fontSize: '13px' }}>Klik <strong>"⚡ Generate Payroll"</strong> untuk membuat entri dari data karyawan aktif.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '140px' }}>Karyawan</th>
                    <th>Cabang</th>
                    <th style={{ textAlign: 'right' }}>Gaji+Tunj.</th>
                    <th style={{ textAlign: 'right' }}>Bonus</th>
                    <th style={{ textAlign: 'right' }}>Potongan</th>
                    <th style={{ textAlign: 'right', color: '#10b981' }}>THP</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const bonus = (e.bonus_penjualan || 0) + (e.bonus_tartun || 0) + (e.bonus_lain || 0);
                    const pot = (e.deduction_kasbon || 0) + (e.deduction_absent || 0) + (e.deduction_late || 0) + (e.deduction_fake_money || 0);
                    return (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.employee_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span style={{ background: e.employee_type === 'Staff' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: e.employee_type === 'Staff' ? '#8b5cf6' : '#3b82f6', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 600 }}>{e.employee_type}</span>
                            {' '}{e.position || ''}
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{e.branch_name || '—'}</td>
                        <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtRp((e.salary || 0) + (e.allowance || 0))}</td>
                        <td style={{ textAlign: 'right', fontSize: '13px', color: '#10b981' }}>
                          {bonus > 0 ? `+${fmtRp(bonus)}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '13px', color: '#ef4444' }}>
                          {pot > 0 ? `(${fmtRp(pot)})` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '14px' }}>{fmtRp(e.take_home_pay)}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setBonusEntry(e)}
                            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: 'var(--color-primary)', padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginRight: '6px', fontFamily: 'inherit' }}>
                            Bonus
                          </button>
                          <button onClick={() => openSlip(e)}
                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
                            Slip
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
      )}

      {/* Rekap Tab */}
      {activeTab === 'rekap' && (
        <div className="glass-panel">
          {summary.data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <p>Belum ada data rekap. Generate payroll terlebih dahulu.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cabang</th>
                      <th>Tipe</th>
                      <th style={{ textAlign: 'center' }}>Karyawan</th>
                      <th style={{ textAlign: 'right' }}>Total THP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.data.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{row.branch_name || 'Tanpa Cabang'}</td>
                        <td>
                          <span style={{ background: row.employee_type === 'Staff' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: row.employee_type === 'Staff' ? '#8b5cf6' : '#3b82f6', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                            {row.employee_type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{row.headcount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '14px' }}>{fmtRp(row.total_thp)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(139,92,246,0.08)' }}>
                      <td colSpan={2} style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px', padding: '12px 16px' }}>GRAND TOTAL</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{summary.data.reduce((s, r) => s + r.headcount, 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '16px', padding: '12px 16px' }}>{fmtRp(summary.grand_total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {slipData && <SlipModal slip={slipData} onClose={() => setSlipData(null)} />}
      {bonusEntry && <BonusModal entry={bonusEntry} onSave={handleBonusSave} onClose={() => setBonusEntry(null)} />}
    </div>
  );
}
