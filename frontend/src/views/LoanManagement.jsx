import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { loanApi, staffApi, branchApi } from '../services/api';

const fmt = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
const fmtRp = (n) => `Rp ${fmt(n)}`;

const inp = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
};

const lbl = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function currentPeriodStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const LOAN_BADGE = {
  Active:    { bg: 'var(--color-info-bg)',    color: 'var(--color-info)' },
  'Paid Off':{ bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  Cancelled: { bg: 'rgba(107,114,128,0.14)',  color: 'var(--text-muted)' },
};

export default function LoanManagement() {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState({ active_count: 0, total_remaining: 0, est_monthly_installment: 0, paid_off_count: 0 });
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Active');
  const [branchFilter, setBranchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    employee_id: '',
    loan_type: 'Kasbon',
    principal_amount: '',
    tenor_months: 3,
    monthly_installment: '',
    start_period: currentPeriodStr(),
    notes: '',
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Detail & Payment Modal
  const [detailLoan, setDetailLoan] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Tunai');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    branchApi.getAll().then(r => { if (r.success) setBranches((r.data || []).filter(b => b.status === 'Active')); }).catch(() => {});
    staffApi.getAll({ status: 'Active' }).then(r => { if (r.success) setEmployees(r.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (detailLoan && !paying) setDetailLoan(null);
      else if (showCreate && !creating) setShowCreate(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreate, creating, detailLoan, paying]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (branchFilter) params.branch_id = branchFilter;
      const [listRes, sumRes] = await Promise.all([loanApi.getAll(params), loanApi.getSummary()]);
      if (listRes.success) setLoans(listRes.data || []);
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
    } catch (err) {
      setError(err.message || 'Gagal memuat data pinjaman.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, branchFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openDetail = async (loan) => {
    try {
      const res = await loanApi.getById(loan.id);
      if (res.success) {
        setDetailLoan(res.data);
        setPayAmount(String(Math.min(res.data.monthly_installment, res.data.remaining_amount) || ''));
        setPayNotes('');
      }
    } catch (err) {
      alert(err.message || 'Gagal memuat detail pinjaman.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.employee_id || !createForm.principal_amount) {
      setCreateError('Karyawan dan nominal wajib diisi.');
      return;
    }
    setCreating(true);
    try {
      const res = await loanApi.create(createForm);
      if (res.success) {
        setShowCreate(false);
        loadAll();
      } else {
        setCreateError(res.message || 'Gagal mencatat pinjaman.');
      }
    } catch (err) {
      setCreateError(err.message || 'Gagal mencatat pinjaman.');
    } finally {
      setCreating(false);
    }
  };

  const handleManualPay = async (e) => {
    e.preventDefault();
    if (!detailLoan || paying) return;
    setPaying(true);
    try {
      const res = await loanApi.recordPayment(detailLoan.id, {
        amount: payAmount,
        payment_method: payMethod,
        notes: payNotes,
      });
      if (res.success) {
        const refreshed = await loanApi.getById(detailLoan.id);
        if (refreshed.success) setDetailLoan(refreshed.data);
        loadAll();
      } else {
        alert(res.message || 'Gagal mencatat pembayaran.');
      }
    } catch (err) {
      alert(err.message || 'Gagal mencatat pembayaran.');
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async (loan) => {
    if (!window.confirm(`Batalkan pinjaman ${loan.loan_type} atas nama ${loan.employee_name}?`)) return;
    try {
      const res = await loanApi.cancel(loan.id);
      if (res.success) loadAll();
      else alert(res.message || 'Gagal membatalkan pinjaman.');
    } catch (err) {
      alert(err.message || 'Gagal membatalkan pinjaman.');
    }
  };

  const autoEstInstallment = () => {
    const p = parseFloat(createForm.principal_amount) || 0;
    const t = parseInt(createForm.tenor_months, 10) || 1;
    return p > 0 ? Math.ceil(p / Math.max(1, t)) : 0;
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Kasbon &amp; Pinjaman Berjangka</h1>
          <p className="page-subtitle">Cicilan bulanan otomatis terpotong di Payroll saat periode digenerate &amp; disubmit.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCreateForm({
              employee_id: employees[0]?.id ? String(employees[0].id) : '',
              loan_type: 'Kasbon',
              principal_amount: '',
              tenor_months: 3,
              monthly_installment: '',
              start_period: currentPeriodStr(),
              notes: '',
            });
            setCreateError('');
            setShowCreate(true);
          }}
        >
          + Catat Pinjaman / Kasbon
        </button>
      </div>

      {/* KPIs */}
      <div className="stats-grid responsive-grid-3" style={{ marginBottom: '20px' }}>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Pinjaman Aktif</div>
          <div className="stat-card-value" style={{ color: 'var(--color-info)' }}>{summary.active_count || 0}</div>
          <div className="stat-card-desc">Lunas: {summary.paid_off_count || 0} pinjaman</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Total Sisa Saldo</div>
          <div className="stat-card-value" style={{ color: 'var(--color-warning)', fontSize: '20px' }}>{fmtRp(summary.total_remaining)}</div>
          <div className="stat-card-desc">Belum terbayar</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Est. Potongan / Bulan</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)', fontSize: '20px' }}>{fmtRp(summary.est_monthly_installment)}</div>
          <div className="stat-card-desc">Terpotong di Payroll aktif</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...inp, width: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="Active">Active (Berjalan)</option>
          <option value="Paid Off">Paid Off (Lunas)</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select style={{ ...inp, width: '200px' }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">Semua Cabang</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary" onClick={loadAll}>Coba Lagi</button>
        </div>
      )}

      <div className="glass-panel">
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />Memuat pinjaman...
          </div>
        ) : loans.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data pinjaman untuk filter ini.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Jenis</th>
                  <th style={{ textAlign: 'right' }}>Pokok</th>
                  <th style={{ textAlign: 'right' }}>Cicilan/Bln</th>
                  <th style={{ textAlign: 'right' }}>Sisa Saldo</th>
                  <th style={{ textAlign: 'center' }}>Mulai</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(l => {
                  const badge = LOAN_BADGE[l.status] || LOAN_BADGE.Active;
                  const paid = Math.max(0, l.principal_amount - l.remaining_amount);
                  const pct = l.principal_amount > 0 ? Math.round((paid / l.principal_amount) * 100) : 0;
                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.employee_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.branch_name || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{l.loan_type}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.tenor_months} bulan</div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtRp(l.principal_amount)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-info)', fontWeight: 600 }}>{fmtRp(l.monthly_installment)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: l.remaining_amount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{fmtRp(l.remaining_amount)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}% terbayar</div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '12px' }}>{l.start_period}</td>
                      <td>
                        <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => openDetail(l)} style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info)', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '6px' }}>Detail &amp; Bayar</button>
                        {l.status === 'Active' && (
                          <button type="button" onClick={() => handleCancel(l)} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Loan Modal */}
      {showCreate && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !creating) setShowCreate(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Catat Pinjaman / Kasbon Berjangka</h3>
              <button type="button" disabled={creating} onClick={() => setShowCreate(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Karyawan</label>
                <select style={inp} value={createForm.employee_id} onChange={e => setCreateForm(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.branch_name ? `(${emp.branch_name})` : ''}</option>)}
                </select>
              </div>
              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={lbl}>Jenis</label>
                  <select style={inp} value={createForm.loan_type} onChange={e => setCreateForm(p => ({ ...p, loan_type: e.target.value }))}>
                    <option value="Kasbon">Kasbon</option>
                    <option value="Pinjaman Karyawan">Pinjaman Karyawan</option>
                    <option value="Ganti Rugi">Ganti Rugi / Selisih</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Mulai Potong Periode</label>
                  <input type="month" style={inp} value={createForm.start_period} onChange={e => setCreateForm(p => ({ ...p, start_period: e.target.value }))} required />
                </div>
              </div>
              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={lbl}>Nominal Pokok (Rp)</label>
                  <input type="number" min="1000" step="1000" style={inp} value={createForm.principal_amount} onChange={e => setCreateForm(p => ({ ...p, principal_amount: e.target.value }))} required placeholder="1500000" />
                </div>
                <div>
                  <label style={lbl}>Tenor (Bulan)</label>
                  <input type="number" min="1" max="120" style={inp} value={createForm.tenor_months} onChange={e => setCreateForm(p => ({ ...p, tenor_months: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={lbl}>Cicilan per Bulan (opsional, default: {fmtRp(autoEstInstallment())})</label>
                <input type="number" min="0" step="1000" style={inp} value={createForm.monthly_installment} onChange={e => setCreateForm(p => ({ ...p, monthly_installment: e.target.value }))} placeholder={`Otomatis ${fmtRp(autoEstInstallment())}`} />
              </div>
              <div>
                <label style={lbl}>Catatan</label>
                <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={createForm.notes} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))} placeholder="Keterangan keperluan kasbon..." />
              </div>
              {createError && <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>{createError}</div>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" disabled={creating} onClick={() => setShowCreate(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{creating ? 'Menyimpan...' : 'Simpan Pinjaman'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Detail & Payment Modal */}
      {detailLoan && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !paying) setDetailLoan(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>{detailLoan.employee_name} — {detailLoan.loan_type}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Pokok: {fmtRp(detailLoan.principal_amount)} · Sisa: <strong style={{ color: 'var(--color-warning)' }}>{fmtRp(detailLoan.remaining_amount)}</strong>
                </p>
              </div>
              <button type="button" disabled={paying} onClick={() => setDetailLoan(null)} className="close-btn">×</button>
            </div>

            {detailLoan.status === 'Active' && detailLoan.remaining_amount > 0 && (
              <form onSubmit={handleManualPay} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>CATAT PEMBAYARAN MANUAL (TUNAI / TRANSFER)</div>
                <div className="responsive-grid-2" style={{ gap: '10px' }}>
                  <div>
                    <label style={lbl}>Nominal Bayar (Rp)</label>
                    <input type="number" min="1" max={detailLoan.remaining_amount} style={inp} value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label style={lbl}>Metode</label>
                    <select style={inp} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                      <option value="Tunai">Tunai</option>
                      <option value="Transfer">Transfer</option>
                    </select>
                  </div>
                </div>
                <input style={inp} placeholder="Catatan pembayaran (opsional)" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                <button type="submit" disabled={paying} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  {paying ? 'Menyimpan...' : 'Catat Pembayaran'}
                </button>
              </form>
            )}

            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>RIWAYAT CICILAN &amp; PELUNASAN</div>
            {(!detailLoan.payments || detailLoan.payments.length === 0) ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Belum ada riwayat pembayaran tercatat.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Periode</th>
                    <th>Metode</th>
                    <th style={{ textAlign: 'right' }}>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoan.payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '12px' }}>{p.payment_date}</td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{p.period || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{p.payment_method}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>{fmtRp(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
