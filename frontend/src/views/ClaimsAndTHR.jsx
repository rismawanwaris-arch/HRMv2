import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { claimsApi, attendanceApi, dropdownOptionsApi } from '../services/api';
import { DEFAULT_DROPDOWN_OPTIONS, withCurrentOption } from '../utils/dropdownDefaults';

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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentPeriodStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const BADGE = {
  Pending:  { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  Approved: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  Paid:     { bg: 'var(--color-info-bg)',    color: 'var(--color-info)' },
  Rejected: { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)' },
};

export default function ClaimsAndTHR({ currentRole = 'master' }) {
  const canApprove = ['finance', 'master'].includes(currentRole);
  const [activeTab, setActiveTab] = useState('overtime');
  const [statusFilter, setStatusFilter] = useState('');
  const [employees, setEmployees] = useState([]);

  // Overtime
  const [overtimes, setOvertimes] = useState([]);
  const [showOtModal, setShowOtModal] = useState(false);
  const [otForm, setOtForm] = useState({ employee_id: '', date: todayStr(), hours: 2, day_type: 'weekday', reason: '' });
  const [otError, setOtError] = useState('');
  const [otSaving, setOtSaving] = useState(false);

  // Reimbursement
  const [reimbCategories, setReimbCategories] = useState(DEFAULT_DROPDOWN_OPTIONS.reimbursement_categories);
  const [reimbursements, setReimbursements] = useState([]);
  const [showReimbModal, setShowReimbModal] = useState(false);
  const [reimbForm, setReimbForm] = useState({ employee_id: '', claim_date: todayStr(), category: 'Transportasi', amount: '', description: '' });
  const [reimbFile, setReimbFile] = useState(null);
  const [reimbError, setReimbError] = useState('');
  const [reimbSaving, setReimbSaving] = useState(false);

  // THR
  const [thrTargetDate, setThrTargetDate] = useState(todayStr());
  const [thrPeriod, setThrPeriod] = useState(currentPeriodStr());
  const [thrPreview, setThrPreview] = useState({ data: [], total_thr: 0 });
  const [thrApplying, setThrApplying] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    attendanceApi.getByDate({ date: todayStr() }).then(r => { if (r.success) setEmployees(r.data || []); }).catch(() => {});
    dropdownOptionsApi.getAll()
      .then(r => {
        if (r.success && r.data?.reimbursement_categories?.length) {
          setReimbCategories(r.data.reimbursement_categories);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (showOtModal && !otSaving) setShowOtModal(false);
      if (showReimbModal && !reimbSaving) setShowReimbModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOtModal, otSaving, showReimbModal, reimbSaving]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      if (activeTab === 'overtime') {
        const res = await claimsApi.getOvertime(params);
        if (res.success) setOvertimes(res.data || []);
      } else if (activeTab === 'reimburse') {
        const res = await claimsApi.getReimbursements(params);
        if (res.success) setReimbursements(res.data || []);
      } else if (activeTab === 'thr' && canApprove) {
        const res = await claimsApi.previewTHR(thrTargetDate);
        if (res.success) setThrPreview({ data: res.data || [], total_thr: res.total_thr || 0 });
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, canApprove, thrTargetDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitOt = async (e) => {
    e.preventDefault();
    setOtError('');
    setOtSaving(true);
    try {
      const res = await claimsApi.createOvertime(otForm);
      if (res.success) {
        setShowOtModal(false);
        loadData();
      } else {
        setOtError(res.message || 'Gagal mengajukan lembur.');
      }
    } catch (err) {
      setOtError(err.message || 'Gagal mengajukan lembur.');
    } finally {
      setOtSaving(false);
    }
  };

  const handleSubmitReimb = async (e) => {
    e.preventDefault();
    setReimbError('');
    setReimbSaving(true);
    try {
      const fd = new FormData();
      fd.append('employee_id', reimbForm.employee_id);
      fd.append('claim_date', reimbForm.claim_date);
      fd.append('category', reimbForm.category);
      fd.append('amount', reimbForm.amount);
      fd.append('description', reimbForm.description);
      if (reimbFile) fd.append('receipt', reimbFile);

      const res = await claimsApi.createReimbursement(fd);
      if (res.success) {
        setShowReimbModal(false);
        setReimbFile(null);
        loadData();
      } else {
        setReimbError(res.message || 'Gagal mengirim klaim.');
      }
    } catch (err) {
      setReimbError(err.message || 'Gagal mengirim klaim.');
    } finally {
      setReimbSaving(false);
    }
  };

  const handleOtAction = async (id, action) => {
    setBusyId(`ot-${id}`);
    try {
      const res = action === 'approve'
        ? await claimsApi.approveOvertime(id, {})
        : action === 'reject'
        ? await claimsApi.rejectOvertime(id, {})
        : await claimsApi.deleteOvertime(id);
      if (res.success) loadData();
      else alert(res.message || 'Gagal memproses.');
    } catch (err) {
      alert(err.message || 'Gagal memproses.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReimbAction = async (id, action) => {
    setBusyId(`rm-${id}`);
    try {
      const res = action === 'approve'
        ? await claimsApi.approveReimbursement(id, {})
        : action === 'reject'
        ? await claimsApi.rejectReimbursement(id, {})
        : await claimsApi.deleteReimbursement(id);
      if (res.success) loadData();
      else alert(res.message || 'Gagal memproses.');
    } catch (err) {
      alert(err.message || 'Gagal memproses.');
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyTHR = async () => {
    if (!window.confirm(`Terapkan THR per tanggal acuan ${thrTargetDate} ke Payroll periode ${thrPeriod}?\n\nPastikan periode payroll tersebut masih berstatus Draft.`)) return;
    setThrApplying(true);
    try {
      const res = await claimsApi.applyTHR({ period: thrPeriod, target_date: thrTargetDate });
      if (res.success) alert(res.message);
      else alert(res.message || 'Gagal menerapkan THR.');
    } catch (err) {
      alert(err.message || 'Gagal menerapkan THR.');
    } finally {
      setThrApplying(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Lembur, Reimbursement &amp; THR</h1>
          <p className="page-subtitle">Otomatisasi upah lembur PP 35/2021, klaim struk biaya, dan kalkulator THR Permenaker 6/2016.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'overtime' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setOtForm({ employee_id: employees[0]?.id ? String(employees[0].id) : '', date: todayStr(), hours: 2, day_type: 'weekday', reason: '' });
                setOtError('');
                setShowOtModal(true);
              }}
            >
              + Ajukan Lembur
            </button>
          )}
          {activeTab === 'reimburse' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setReimbForm({ employee_id: employees[0]?.id ? String(employees[0].id) : '', claim_date: todayStr(), category: 'Transportasi', amount: '', description: '' });
                setReimbFile(null);
                setReimbError('');
                setShowReimbModal(true);
              }}
            >
              + Ajukan Reimbursement
            </button>
          )}
          {activeTab === 'thr' && canApprove && (
            <button type="button" className="btn btn-primary" disabled={thrApplying} onClick={handleApplyTHR}>
              {thrApplying ? 'Menerapkan...' : `Terapkan THR ke Payroll ${thrPeriod}`}
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'overtime', label: 'Lembur (PP 35/2021)' },
            { id: 'reimburse', label: 'Reimbursement / Klaim' },
            ...(canApprove ? [{ id: 'thr', label: 'Kalkulator THR' }] : []),
          ].map(t => (
            <button
              type="button"
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '13px', fontWeight: 600,
                background: activeTab === t.id ? 'var(--primary)' : 'var(--bg-secondary)',
                color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab !== 'thr' ? (
          <select style={{ ...inp, width: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            {activeTab === 'reimburse' && <option value="Paid">Paid</option>}
            <option value="Rejected">Rejected</option>
          </select>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '6px' }}>Tgl Acuan Hari Raya:</span>
              <input type="date" style={{ ...inp, width: '150px', display: 'inline-block' }} value={thrTargetDate} onChange={e => setThrTargetDate(e.target.value)} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '6px' }}>Masuk Periode:</span>
              <input type="month" style={{ ...inp, width: '150px', display: 'inline-block' }} value={thrPeriod} onChange={e => setThrPeriod(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary" onClick={loadData}>Coba Lagi</button>
        </div>
      )}

      <div className="glass-panel">
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />Memuat data...
          </div>
        ) : activeTab === 'overtime' ? (
          overtimes.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data lembur.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Karyawan</th>
                    <th style={{ textAlign: 'center' }}>Durasi</th>
                    <th>Tipe Hari</th>
                    <th style={{ textAlign: 'right' }}>Upah Lembur</th>
                    <th>Keterangan</th>
                    <th>Status</th>
                    {canApprove && <th style={{ textAlign: 'center' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {overtimes.map(o => {
                    const b = BADGE[o.status] || BADGE.Pending;
                    const busy = busyId === `ot-${o.id}`;
                    return (
                      <tr key={o.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{o.date}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{o.employee_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.branch_name || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{o.hours} jam</td>
                        <td style={{ fontSize: '12px' }}>{o.day_type === 'holiday' ? 'Hari Libur/Minggu' : 'Hari Kerja'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>{fmtRp(o.calculated_amount)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{o.reason || '—'}</td>
                        <td><span style={{ background: b.bg, color: b.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{o.status}</span></td>
                        {canApprove && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {o.status === 'Pending' && (
                              <>
                                <button type="button" disabled={busy} onClick={() => handleOtAction(o.id, 'approve')} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '6px' }}>Setujui</button>
                                <button type="button" disabled={busy} onClick={() => handleOtAction(o.id, 'reject')} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Tolak</button>
                              </>
                            )}
                            {o.status === 'Rejected' && (
                              <button type="button" disabled={busy} onClick={() => handleOtAction(o.id, 'delete')} style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>Hapus</button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'reimburse' ? (
          reimbursements.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data klaim reimbursement.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Karyawan</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'right' }}>Nominal</th>
                    <th style={{ textAlign: 'center' }}>Periode Gaji</th>
                    <th>Struk</th>
                    <th>Status</th>
                    {canApprove && <th style={{ textAlign: 'center' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {reimbursements.map(r => {
                    const b = BADGE[r.status] || BADGE.Pending;
                    const busy = busyId === `rm-${r.id}`;
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{r.claim_date}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.employee_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.branch_name || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.category}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.description || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>{fmtRp(r.amount)}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '12px' }}>{r.payroll_period || '—'}</td>
                        <td>
                          {r.receipt_photo ? (
                            <a href={claimsApi.getReceiptUrl(r.receipt_photo)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', fontSize: '12px', fontWeight: 600 }}>Lihat Struk</a>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                        </td>
                        <td><span style={{ background: b.bg, color: b.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{r.status}</span></td>
                        {canApprove && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {r.status === 'Pending' && (
                              <>
                                <button type="button" disabled={busy} onClick={() => handleReimbAction(r.id, 'approve')} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '6px' }}>Setujui</button>
                                <button type="button" disabled={busy} onClick={() => handleReimbAction(r.id, 'reject')} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Tolak</button>
                              </>
                            )}
                            {r.status === 'Rejected' && (
                              <button type="button" disabled={busy} onClick={() => handleReimbAction(r.id, 'delete')} style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>Hapus</button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Cabang</th>
                  <th>Tgl Masuk</th>
                  <th style={{ textAlign: 'center' }}>Masa Kerja</th>
                  <th style={{ textAlign: 'right' }}>Upah Basis</th>
                  <th style={{ textAlign: 'center' }}>Proporsi</th>
                  <th style={{ textAlign: 'right' }}>Estimasi THR</th>
                </tr>
              </thead>
              <tbody>
                {thrPreview.data.map(item => (
                  <tr key={item.employee_id}>
                    <td style={{ fontWeight: 600 }}>{item.employee_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.branch_name || '—'}</td>
                    <td style={{ fontSize: '12px' }}>{item.hire_date || 'Belum diisi'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.months_of_service} bln</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtRp(item.base_wage)}</td>
                    <td style={{ textAlign: 'center' }}>{Math.round((item.ratio || 0) * 100)}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: item.amount > 0 ? 'var(--color-success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtRp(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <td colSpan={6} style={{ fontWeight: 800, padding: '12px 16px' }}>TOTAL ESTIMASI THR ({thrPreview.data.length} KARYAWAN)</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-success)', fontSize: '15px', padding: '12px 16px', whiteSpace: 'nowrap' }}>{fmtRp(thrPreview.total_thr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Overtime Modal */}
      {showOtModal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !otSaving) setShowOtModal(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Ajukan Lembur</h3>
              <button type="button" disabled={otSaving} onClick={() => setShowOtModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmitOt} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={lbl}>Karyawan</label>
                <select style={inp} value={otForm.employee_id} onChange={e => setOtForm(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.branch_name ? `(${emp.branch_name})` : ''}</option>)}
                </select>
              </div>
              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={lbl}>Tanggal</label>
                  <input type="date" style={inp} value={otForm.date} onChange={e => setOtForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>Durasi (Jam)</label>
                  <input type="number" min="0.5" max="24" step="0.5" style={inp} value={otForm.hours} onChange={e => setOtForm(p => ({ ...p, hours: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={lbl}>Jenis Hari (PP 35/2021)</label>
                <select style={inp} value={otForm.day_type} onChange={e => setOtForm(p => ({ ...p, day_type: e.target.value }))}>
                  <option value="weekday">Hari Kerja (1.5x jam I, 2x dst)</option>
                  <option value="holiday">Hari Libur / Minggu (2x-4x)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Keperluan / Pekerjaan</label>
                <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={otForm.reason} onChange={e => setOtForm(p => ({ ...p, reason: e.target.value }))} placeholder="Contoh: Stock opname akhir bulan" />
              </div>
              {otError && <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '8px', borderRadius: '8px', fontSize: '12px' }}>{otError}</div>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" disabled={otSaving} onClick={() => setShowOtModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={otSaving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{otSaving ? 'Mengirim...' : 'Simpan Pengajuan'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Reimbursement Modal */}
      {showReimbModal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !reimbSaving) setShowReimbModal(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Ajukan Reimbursement / Klaim</h3>
              <button type="button" disabled={reimbSaving} onClick={() => setShowReimbModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmitReimb} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={lbl}>Karyawan</label>
                <select style={inp} value={reimbForm.employee_id} onChange={e => setReimbForm(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.branch_name ? `(${emp.branch_name})` : ''}</option>)}
                </select>
              </div>
              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={lbl}>Tanggal Klaim</label>
                  <input type="date" style={inp} value={reimbForm.claim_date} onChange={e => setReimbForm(p => ({ ...p, claim_date: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>Kategori</label>
                  <select style={inp} value={reimbForm.category} onChange={e => setReimbForm(p => ({ ...p, category: e.target.value }))}>
                    {withCurrentOption(reimbCategories, reimbForm.category).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Nominal Klaim (Rp)</label>
                <input type="number" min="1" step="500" style={inp} value={reimbForm.amount} onChange={e => setReimbForm(p => ({ ...p, amount: e.target.value }))} required placeholder="50000" />
              </div>
              <div>
                <label style={lbl}>Upload Foto Struk / Bukti (opsional)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={inp} onChange={e => setReimbFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label style={lbl}>Keterangan</label>
                <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={reimbForm.description} onChange={e => setReimbForm(p => ({ ...p, description: e.target.value }))} placeholder="Detail pengeluaran..." />
              </div>
              {reimbError && <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '8px', borderRadius: '8px', fontSize: '12px' }}>{reimbError}</div>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" disabled={reimbSaving} onClick={() => setShowReimbModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={reimbSaving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{reimbSaving ? 'Mengirim...' : 'Kirim Klaim'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
