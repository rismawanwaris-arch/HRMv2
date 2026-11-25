import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { leaveApi, attendanceApi, branchApi } from '../services/api';

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

const REQ_BADGE = {
  Pending:   { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  Approved:  { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  Rejected:  { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)' },
  Cancelled: { bg: 'rgba(107,114,128,0.14)',  color: 'var(--text-muted)' },
};

export default function LeaveManagement({ currentRole = 'master' }) {
  const canApprove = ['finance', 'master'].includes(currentRole);
  const [activeTab, setActiveTab] = useState('requests');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Request Modal
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqForm, setReqForm] = useState({ employee_id: '', leave_type_id: '', start_date: todayStr(), end_date: todayStr(), reason: '' });
  const [reqError, setReqError] = useState('');
  const [reqSaving, setReqSaving] = useState(false);

  // Edit Balance Modal
  const [editBal, setEditBal] = useState(null);
  const [balForm, setBalForm] = useState({ quota: 12, carry_over: 0 });
  const [balSaving, setBalSaving] = useState(false);

  // Leave Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({ code: '', name: '', default_quota: 0, is_paid: true, attendance_status: 'Cuti', is_active: true });
  const [typeError, setTypeError] = useState('');
  const [typeSaving, setTypeSaving] = useState(false);

  const [actionBusyId, setActionBusyId] = useState(null);

  useEffect(() => {
    branchApi.getAll().then(r => { if (r.success) setBranches((r.data || []).filter(b => b.status === 'Active')); }).catch(() => {});
    attendanceApi.getByDate({ date: todayStr() }).then(r => { if (r.success) setEmployees(r.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (showTypeModal && !typeSaving) setShowTypeModal(false);
      else if (editBal && !balSaving) setEditBal(null);
      else if (showReqModal && !reqSaving) setShowReqModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showReqModal, reqSaving, editBal, balSaving, showTypeModal, typeSaving]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const reqParams = { year };
      if (statusFilter) reqParams.status = statusFilter;
      if (branchFilter) reqParams.branch_id = branchFilter;

      const balParams = { year };
      if (branchFilter) balParams.branch_id = branchFilter;

      const [tRes, rRes, bRes] = await Promise.all([
        leaveApi.getTypes(canApprove),
        leaveApi.getRequests(reqParams),
        leaveApi.getBalances(balParams),
      ]);
      if (tRes.success) setLeaveTypes(tRes.data || []);
      if (rRes.success) setRequests(rRes.data || []);
      if (bRes.success) setBalances(bRes.data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat data cuti.');
    } finally {
      setLoading(false);
    }
  }, [year, statusFilter, branchFilter, canApprove]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const activeLeaveTypes = leaveTypes.filter(t => t.is_active);
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedDaysCount = requests.filter(r => r.status === 'Approved').reduce((s, r) => s + (r.total_days || 0), 0);

  const openCreateReq = () => {
    setReqForm({
      employee_id: employees[0]?.id ? String(employees[0].id) : '',
      leave_type_id: activeLeaveTypes[0]?.id ? String(activeLeaveTypes[0].id) : '',
      start_date: todayStr(),
      end_date: todayStr(),
      reason: '',
    });
    setReqError('');
    setShowReqModal(true);
  };

  const handleSubmitReq = async (e) => {
    e.preventDefault();
    setReqError('');
    if (!reqForm.employee_id || !reqForm.leave_type_id) {
      setReqError('Pilih karyawan dan jenis cuti terlebih dahulu.');
      return;
    }
    setReqSaving(true);
    try {
      const res = await leaveApi.createRequest(reqForm);
      if (res.success) {
        setShowReqModal(false);
        loadAll();
      } else {
        setReqError(res.message || 'Gagal mengirim pengajuan cuti.');
      }
    } catch (err) {
      setReqError(err.message || 'Gagal mengirim pengajuan cuti.');
    } finally {
      setReqSaving(false);
    }
  };

  const handleApprove = async (req) => {
    if (!window.confirm(`Setujui pengajuan ${req.leave_type_name} untuk ${req.employee_name} (${req.total_days} hari)?\n\nAbsensi pada tanggal tersebut akan disinkronkan otomatis.`)) return;
    setActionBusyId(req.id);
    try {
      const res = await leaveApi.approveRequest(req.id, {});
      if (res.success) loadAll();
      else alert(res.message || 'Gagal menyetujui.');
    } catch (err) {
      alert(err.message || 'Gagal menyetujui.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (req) => {
    const note = window.prompt(`Alasan penolakan untuk ${req.employee_name} (opsional):`, '');
    if (note === null) return;
    setActionBusyId(req.id);
    try {
      const res = await leaveApi.rejectRequest(req.id, { approval_notes: note });
      if (res.success) loadAll();
      else alert(res.message || 'Gagal menolak.');
    } catch (err) {
      alert(err.message || 'Gagal menolak.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCancel = async (req) => {
    const warn = req.status === 'Approved'
      ? `Batalkan cuti yang sudah disetujui untuk ${req.employee_name}? Kuota & absensi terkait akan dikembalikan.`
      : `Batalkan pengajuan cuti ${req.employee_name}?`;
    if (!window.confirm(warn)) return;
    setActionBusyId(req.id);
    try {
      const res = await leaveApi.cancelRequest(req.id, {});
      if (res.success) loadAll();
      else alert(res.message || 'Gagal membatalkan.');
    } catch (err) {
      alert(err.message || 'Gagal membatalkan.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleInitYear = async () => {
    if (!window.confirm(`Inisialisasi saldo cuti tahun ${year} untuk semua karyawan aktif yang belum memiliki saldo?`)) return;
    try {
      const res = await leaveApi.initYearBalances({ year, carry_over_max: 0 });
      if (res.success) {
        alert(res.message);
        loadAll();
      } else {
        alert(res.message || 'Gagal inisialisasi.');
      }
    } catch (err) {
      alert(err.message || 'Gagal inisialisasi.');
    }
  };

  const handleSaveBalance = async (e) => {
    e.preventDefault();
    if (!editBal) return;
    setBalSaving(true);
    try {
      const res = await leaveApi.updateBalance(editBal.id, balForm);
      if (res.success) {
        setEditBal(null);
        loadAll();
      } else {
        alert(res.message || 'Gagal menyimpan saldo.');
      }
    } catch (err) {
      alert(err.message || 'Gagal menyimpan saldo.');
    } finally {
      setBalSaving(false);
    }
  };

  const openTypeModal = (t = null) => {
    setEditingType(t);
    setTypeForm(t ? {
      code: t.code,
      name: t.name,
      default_quota: t.default_quota,
      is_paid: !!t.is_paid,
      attendance_status: t.attendance_status,
      is_active: !!t.is_active,
    } : { code: '', name: '', default_quota: 0, is_paid: true, attendance_status: 'Cuti', is_active: true });
    setTypeError('');
    setShowTypeModal(true);
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    setTypeSaving(true);
    setTypeError('');
    try {
      const payload = {
        ...typeForm,
        default_quota: parseInt(typeForm.default_quota, 10) || 0,
        is_paid: typeForm.is_paid ? 1 : 0,
        is_active: typeForm.is_active ? 1 : 0,
      };
      const res = editingType
        ? await leaveApi.updateType(editingType.id, payload)
        : await leaveApi.createType(payload);
      if (res.success) {
        setShowTypeModal(false);
        loadAll();
      } else {
        setTypeError(res.message || 'Gagal menyimpan jenis cuti.');
      }
    } catch (err) {
      setTypeError(err.message || 'Gagal menyimpan jenis cuti.');
    } finally {
      setTypeSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Manajemen Cuti &amp; Izin</h1>
          <p className="page-subtitle">Pengajuan cuti terintegrasi dengan saldo kuota tahunan, absensi harian, dan payroll.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canApprove && activeTab === 'balances' && (
            <button type="button" className="btn btn-secondary" onClick={handleInitYear}>
              Inisialisasi Kuota {year}
            </button>
          )}
          {canApprove && activeTab === 'types' && (
            <button type="button" className="btn btn-secondary" onClick={() => openTypeModal(null)}>
              + Jenis Cuti
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={openCreateReq}>
            + Ajukan Cuti / Izin
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid responsive-grid-3" style={{ marginBottom: '20px' }}>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Menunggu Persetujuan</div>
          <div className="stat-card-value" style={{ color: 'var(--color-warning)' }}>{pendingCount}</div>
          <div className="stat-card-desc">Pengajuan status Pending</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Disetujui ({year})</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{approvedDaysCount} <span style={{ fontSize: '14px', fontWeight: 500 }}>hari</span></div>
          <div className="stat-card-desc">Tersinkron ke absensi harian</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Total Saldo Tercatat</div>
          <div className="stat-card-value" style={{ color: 'var(--color-primary)' }}>{balances.length}</div>
          <div className="stat-card-desc">Karyawan aktif tahun {year}</div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'requests', label: `Daftar Pengajuan (${requests.length})` },
            { id: 'balances', label: 'Saldo Cuti Tahunan' },
            ...(canApprove ? [{ id: 'types', label: 'Jenis Cuti' }] : []),
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
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select style={{ ...inp, width: '100px' }} value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select style={{ ...inp, width: '170px' }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {activeTab === 'requests' && (
            <select style={{ ...inp, width: '140px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Semua Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary" onClick={loadAll}>Coba Lagi</button>
        </div>
      )}

      {/* Content */}
      <div className="glass-panel">
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />Memuat data...
          </div>
        ) : activeTab === 'requests' ? (
          requests.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada pengajuan cuti/izin.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Jenis Cuti</th>
                    <th>Tanggal</th>
                    <th style={{ textAlign: 'center' }}>Durasi</th>
                    <th>Keterangan</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const badge = REQ_BADGE[r.status] || REQ_BADGE.Pending;
                    const busy = actionBusyId === r.id;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.employee_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.branch_name || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.leave_type_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Absen: {r.attendance_status}</div>
                        </td>
                        <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{r.start_date} s.d. {r.end_date}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.total_days} hari</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px' }}>
                          {r.reason || '—'}
                          {r.approval_notes && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Catatan: {r.approval_notes}</div>}
                        </td>
                        <td>
                          <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {canApprove && r.status === 'Pending' && (
                            <>
                              <button type="button" disabled={busy} onClick={() => handleApprove(r)} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '6px' }}>Setujui</button>
                              <button type="button" disabled={busy} onClick={() => handleReject(r)} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '6px' }}>Tolak</button>
                            </>
                          )}
                          {(r.status === 'Pending' || (canApprove && r.status === 'Approved')) && (
                            <button type="button" disabled={busy} onClick={() => handleCancel(r)} style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Batalkan</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'balances' ? (
          balances.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data saldo cuti tahun {year}.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Cabang</th>
                    <th>Jenis Cuti</th>
                    <th style={{ textAlign: 'center' }}>Kuota</th>
                    <th style={{ textAlign: 'center' }}>Carry Over</th>
                    <th style={{ textAlign: 'center' }}>Terpakai</th>
                    <th style={{ textAlign: 'center' }}>Sisa</th>
                    {canApprove && <th style={{ textAlign: 'center' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {balances.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.employee_name}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{b.branch_name || '—'}</td>
                      <td style={{ fontSize: '13px' }}>{b.leave_type_name}</td>
                      <td style={{ textAlign: 'center' }}>{b.quota}</td>
                      <td style={{ textAlign: 'center' }}>{b.carry_over}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-warning)', fontWeight: 600 }}>{b.used}</td>
                      <td style={{ textAlign: 'center', color: b.remaining > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>{b.remaining}</td>
                      {canApprove && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => { setEditBal(b); setBalForm({ quota: b.quota, carry_over: b.carry_over }); }}
                            style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info)', borderRadius: '7px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Ubah Kuota
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Jenis Cuti</th>
                  <th style={{ textAlign: 'center' }}>Kuota/Thn</th>
                  <th style={{ textAlign: 'center' }}>Dibayar</th>
                  <th>Status di Absensi</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{t.code}</td>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ textAlign: 'center' }}>{t.default_quota > 0 ? `${t.default_quota} hr` : 'Tanpa Batas'}</td>
                    <td style={{ textAlign: 'center' }}>{t.is_paid ? 'Ya' : 'Unpaid'}</td>
                    <td>{t.attendance_status}</td>
                    <td>{t.is_active ? 'Aktif' : 'Nonaktif'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openTypeModal(t)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Request Modal */}
      {showReqModal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !reqSaving) setShowReqModal(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', backdropFilter: 'blur(6px)', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Ajukan Cuti / Izin</h3>
              <button type="button" disabled={reqSaving} onClick={() => setShowReqModal(false)} className="close-btn">×</button>
            </div>
            <form onSubmit={handleSubmitReq} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Karyawan</label>
                <select style={inp} value={reqForm.employee_id} onChange={e => setReqForm(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.branch_name ? `(${emp.branch_name})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Jenis Cuti</label>
                <select style={inp} value={reqForm.leave_type_id} onChange={e => setReqForm(p => ({ ...p, leave_type_id: e.target.value }))} required>
                  {activeLeaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.is_paid ? 'Dibayar' : 'Unpaid'})</option>)}
                </select>
              </div>
              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={lbl}>Tanggal Mulai</label>
                  <input type="date" style={inp} value={reqForm.start_date} onChange={e => setReqForm(p => ({ ...p, start_date: e.target.value, end_date: p.end_date < e.target.value ? e.target.value : p.end_date }))} required />
                </div>
                <div>
                  <label style={lbl}>Tanggal Selesai</label>
                  <input type="date" style={inp} value={reqForm.end_date} onChange={e => setReqForm(p => ({ ...p, end_date: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={lbl}>Alasan / Keterangan</label>
                <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} value={reqForm.reason} onChange={e => setReqForm(p => ({ ...p, reason: e.target.value }))} placeholder="Contoh: Acara keluarga / Surat dokter..." />
              </div>
              {reqError && <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>{reqError}</div>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" disabled={reqSaving} onClick={() => setShowReqModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={reqSaving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{reqSaving ? 'Mengirim...' : 'Kirim Pengajuan'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Balance Modal */}
      {editBal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !balSaving) setEditBal(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '380px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '17px' }}>Ubah Saldo Cuti — {editBal.employee_name}</h3>
            <form onSubmit={handleSaveBalance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={lbl}>Kuota Tahun {editBal.year}</label>
                <input type="number" min="0" style={inp} value={balForm.quota} onChange={e => setBalForm(p => ({ ...p, quota: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Carry Over Tahun Sebelumnya</label>
                <input type="number" min="0" style={inp} value={balForm.carry_over} onChange={e => setBalForm(p => ({ ...p, carry_over: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="button" disabled={balSaving} onClick={() => setEditBal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={balSaving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{balSaving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Leave Type Modal */}
      {showTypeModal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget && !typeSaving) setShowTypeModal(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px', overscrollBehavior: 'contain' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px' }}>{editingType ? 'Edit Jenis Cuti' : 'Tambah Jenis Cuti'}</h3>
            <form onSubmit={handleSaveType} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!editingType && (
                <div>
                  <label style={lbl}>Kode (Huruf Kapital)</label>
                  <input style={inp} value={typeForm.code} onChange={e => setTypeForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} required placeholder="Contoh: MATERNITY" />
                </div>
              )}
              <div>
                <label style={lbl}>Nama Jenis Cuti</label>
                <input style={inp} value={typeForm.name} onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={lbl}>Kuota Default (0 = Bebas)</label>
                  <input type="number" min="0" style={inp} value={typeForm.default_quota} onChange={e => setTypeForm(p => ({ ...p, default_quota: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Status di Absensi</label>
                  <select style={inp} value={typeForm.attendance_status} onChange={e => setTypeForm(p => ({ ...p, attendance_status: e.target.value }))}>
                    <option value="Cuti">Cuti (Tanpa Potongan)</option>
                    <option value="Izin">Izin (Tanpa Potongan)</option>
                    <option value="Sakit">Sakit (Tanpa Potongan)</option>
                    <option value="Tidak Hadir">Tidak Hadir (Potong Gaji)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={typeForm.is_paid} onChange={e => setTypeForm(p => ({ ...p, is_paid: e.target.checked }))} />
                  Dibayar (Paid)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={typeForm.is_active} onChange={e => setTypeForm(p => ({ ...p, is_active: e.target.checked }))} />
                  Aktif
                </label>
              </div>
              {typeError && <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '8px', borderRadius: '8px', fontSize: '12px' }}>{typeError}</div>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" disabled={typeSaving} onClick={() => setShowTypeModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
                <button type="submit" disabled={typeSaving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>{typeSaving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
