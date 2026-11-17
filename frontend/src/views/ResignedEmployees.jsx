import React, { useState, useEffect, useCallback } from 'react';
import { staffApi, branchApi } from '../services/api';

const RESIGN_REASONS = [
  'Pindah Kerja / Karir Baru',
  'Alasan Keluarga / Menikah',
  'Pindah Domisili / Luar Kota',
  'Melanjutkan Pendidikan / Kuliah',
  'Kondisi Kesehatan',
  'Tidak Cocok Jam Kerja / Shift',
  'Habis Kontrak (Tidak Perpanjang)',
  'Lainnya (Mengundurkan Diri)',
];

const TERMINATED_REASONS = [
  'Pelanggaran Disiplin / SOP',
  'Fraud / Selisih Setoran & Keuangan',
  'Mangkir / Absensi Buruk',
  'Evaluasi Kinerja Tidak Mencapai Target',
  'Sikap / Etika Pelayanan Buruk',
  'Habis Masa Kontrak / Evaluasi',
  'Efisiensi / Penutupan Cabang',
  'Lainnya (Diberhentikan)',
];

const STATUS_BADGE = {
  Resign: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.35)',
    color: '#f59e0b',
    label: '● Resign (Mengundurkan Diri)',
    shortLabel: '● Resign',
  },
  Terminated: {
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.35)',
    color: '#ef4444',
    label: '● Dikeluarkan (Terminated)',
    shortLabel: '● Dikeluarkan',
  },
};

const TYPE_BADGE = {
  Frontliner: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  Staff: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
};

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '9px 13px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function calculateTenure(hireDate, resignDate) {
  if (!hireDate) return '-';
  const start = new Date(hireDate);
  const end = resignDate ? new Date(resignDate) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return '-';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += 30;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} thn`);
  if (months > 0) parts.push(`${months} bln`);
  if (years === 0 && months === 0) parts.push(`${Math.max(days, 1)} hari`);
  return parts.join(' ');
}

function formatDateId(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ResignedEmployees() {
  const [employees, setEmployees] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    branch_id: '',
    employee_type: '',
    status: 'nonactive', // 'nonactive' | 'Resign' | 'Terminated'
  });

  // Modal Tambah / Catat dari Karyawan Aktif
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [recordForm, setRecordForm] = useState({
    employeeId: '',
    status: 'Resign',
    resign_date: new Date().toISOString().slice(0, 10),
    resign_reason: RESIGN_REASONS[0],
    resign_notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal Edit Alasan / Status Keluar
  const [editingEmp, setEditingEmp] = useState(null);
  const [editForm, setEditForm] = useState({
    status: 'Resign',
    resign_date: '',
    resign_reason: '',
    resign_notes: '',
  });

  const fetchResigned = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: filters.status || 'nonactive' };
      if (filters.search) params.search = filters.search;
      if (filters.branch_id) params.branch_id = filters.branch_id;
      if (filters.employee_type) params.employee_type = filters.employee_type;

      const res = await staffApi.getAll(params);
      if (res.success) setEmployees(res.data);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchResigned();
  }, [fetchResigned]);

  useEffect(() => {
    branchApi.getAll().then(r => {
      if (r.success) setBranches(r.data);
    });
  }, []);

  const openRecordModal = async () => {
    try {
      const res = await staffApi.getAll({ status: 'Active' });
      if (res.success) setActiveEmployees(res.data);
    } catch {
      /* silent */
    }
    setEmpSearch('');
    setRecordForm({
      employeeId: '',
      status: 'Resign',
      resign_date: new Date().toISOString().slice(0, 10),
      resign_reason: RESIGN_REASONS[0],
      resign_notes: '',
    });
    setShowRecordModal(true);
  };

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!recordForm.employeeId) {
      alert('Pilih karyawan terlebih dahulu.');
      return;
    }
    if (!recordForm.resign_date) {
      alert('Tanggal keluar wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await staffApi.deactivate(recordForm.employeeId, {
        status: recordForm.status,
        resign_date: recordForm.resign_date,
        resign_reason: recordForm.resign_reason,
        resign_notes: recordForm.resign_notes,
      });
      if (res.success) {
        setShowRecordModal(false);
        fetchResigned();
      } else {
        alert(res.message || 'Gagal menyimpan data.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (emp) => {
    const defaultReasonList = emp.status === 'Terminated' ? TERMINATED_REASONS : RESIGN_REASONS;
    setEditingEmp(emp);
    setEditForm({
      status: emp.status === 'Terminated' ? 'Terminated' : 'Resign',
      resign_date: emp.resign_date || new Date().toISOString().slice(0, 10),
      resign_reason: emp.resign_reason || defaultReasonList[0],
      resign_notes: emp.resign_notes || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingEmp) return;
    setSubmitting(true);
    try {
      const res = await staffApi.deactivate(editingEmp.id, editForm);
      if (res.success) {
        setEditingEmp(null);
        fetchResigned();
      } else {
        alert(res.message || 'Gagal memperbarui data.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (emp) => {
    if (!window.confirm(`Aktifkan kembali "${emp.name}" ke daftar Karyawan Aktif?`)) return;
    try {
      const res = await staffApi.deactivate(emp.id, { status: 'Active' });
      if (res.success) {
        fetchResigned();
      } else {
        alert(res.message || 'Gagal mengaktifkan kembali.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  const totalOut = employees.length;
  const resignCount = employees.filter(e => e.status === 'Resign').length;
  const terminatedCount = employees.filter(e => e.status === 'Terminated').length;
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const thisMonthCount = employees.filter(e => (e.resign_date || '').startsWith(currentMonthPrefix)).length;

  const filteredActiveEmployees = activeEmployees.filter(e => {
    if (!empSearch.trim()) return true;
    const q = empSearch.toLowerCase();
    return (
      (e.name || '').toLowerCase().includes(q) ||
      (e.branch_name || '').toLowerCase().includes(q) ||
      (e.position || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Karyawan Resign & Dikeluarkan</h1>
          <p className="page-subtitle">
            Daftar riwayat karyawan yang mengundurkan diri (Resign) atau diberhentikan (Terminated) beserta alasan lengkapnya.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={openRecordModal}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
          >
            + Catat Karyawan Resign / Keluar
          </button>
        </div>
      </div>

      {/* Statistik Ringkasan */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
        {[
          { label: 'Total Karyawan Keluar', value: totalOut, color: '#94a3b8' },
          { label: 'Resign (Mengundurkan Diri)', value: resignCount, color: '#f59e0b' },
          { label: 'Dikeluarkan (Terminated)', value: terminatedCount, color: '#ef4444' },
          { label: 'Keluar Bulan Ini', value: thisMonthCount, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="glass-panel stat-card">
            <div className="stat-card-title">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <input
          style={{ ...inputStyle, width: '250px' }}
          placeholder="Cari nama, cabang, atau alasan keluar..."
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
        />
        <select
          style={{ ...inputStyle, width: '200px' }}
          value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
        >
          <option value="nonactive">Semua (Resign & Dikeluarkan)</option>
          <option value="Resign">Hanya Resign (Mengundurkan Diri)</option>
          <option value="Terminated">Hanya Dikeluarkan (Terminated)</option>
        </select>
        <select
          style={{ ...inputStyle, width: '170px' }}
          value={filters.branch_id}
          onChange={e => setFilters(p => ({ ...p, branch_id: e.target.value }))}
        >
          <option value="">Semua Cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          style={{ ...inputStyle, width: '150px' }}
          value={filters.employee_type}
          onChange={e => setFilters(p => ({ ...p, employee_type: e.target.value }))}
        >
          <option value="">Semua Tipe</option>
          <option value="Frontliner">Frontliner</option>
          <option value="Staff">Staff</option>
        </select>
      </div>

      {/* Tabel Data Karyawan Resign & Dikeluarkan */}
      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            Memuat data karyawan resign & keluar...
          </div>
        ) : employees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Belum ada data karyawan resign atau dikeluarkan
            </p>
            <p style={{ fontSize: '13px', maxWidth: '480px', margin: '0 auto 18px' }}>
              Klik tombol <strong>"+ Catat Karyawan Resign / Keluar"</strong> di kanan atas untuk memilih dari data karyawan aktif yang sudah ada dan mencatat alasan keluarnya.
            </p>
            <button
              className="btn btn-primary"
              onClick={openRecordModal}
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
            >
              + Catat Karyawan Resign / Keluar
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Karyawan</th>
                  <th>Jabatan & Cabang</th>
                  <th>Masa Kerja</th>
                  <th>Tanggal Keluar</th>
                  <th>Status Keluar</th>
                  <th>Alasan Resign / Dikeluarkan</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const badge = STATUS_BADGE[emp.status] || STATUS_BADGE.Resign;
                  const typeStyle = TYPE_BADGE[emp.employee_type] || TYPE_BADGE.Frontliner;
                  const tenure = calculateTenure(emp.hire_date, emp.resign_date);

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {emp.phone || '-'} {emp.nik ? `· NIK: ${emp.nik}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {emp.position || '-'}
                          </span>
                          <span
                            style={{
                              background: typeStyle.bg,
                              color: typeStyle.color,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {emp.employee_type || 'Frontliner'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          📍 {emp.branch_name || 'Tanpa Cabang'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{tenure}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Masuk: {formatDateId(emp.hire_date)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {formatDateId(emp.resign_date)}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.color,
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.shortLabel}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        {emp.resign_reason ? (
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: emp.resign_notes ? '4px' : 0 }}>
                            {emp.resign_reason}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Belum ada alasan tercatat
                          </span>
                        )}
                        {emp.resign_notes && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            "{emp.resign_notes}"
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => openEditModal(emp)}
                          style={{
                            background: 'rgba(59,130,246,0.12)',
                            border: '1px solid rgba(59,130,246,0.25)',
                            color: '#3b82f6',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            marginRight: '6px',
                          }}
                        >
                          Edit Alasan
                        </button>
                        <button
                          onClick={() => handleReactivate(emp)}
                          style={{
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.25)',
                            color: '#10b981',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Aktifkan Kembali
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

      {/* Modal: Catat Karyawan Resign / Dikeluarkan dari Data Karyawan Aktif */}
      {showRecordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            backdropFilter: 'blur(6px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--bg-surface-opaque)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Catat Karyawan Resign / Dikeluarkan
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Pilih dari data karyawan aktif dan isi alasan mengapa resign atau dikeluarkan
                </p>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Cari & Pilih Karyawan Aktif <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  style={{ ...inputStyle, marginBottom: '8px' }}
                  placeholder="Ketik nama karyawan atau cabang untuk menyaring..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                />
                <select
                  style={inputStyle}
                  required
                  value={recordForm.employeeId}
                  onChange={e => setRecordForm(p => ({ ...p, employeeId: e.target.value }))}
                >
                  <option value="">-- Pilih Karyawan ({filteredActiveEmployees.length} orang) --</option>
                  {filteredActiveEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.branch_name || 'Tanpa Cabang'} ({emp.position || emp.employee_type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Status Keluar <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    style={inputStyle}
                    value={recordForm.status}
                    onChange={e => {
                      const nextStatus = e.target.value;
                      const defaultReason = nextStatus === 'Resign' ? RESIGN_REASONS[0] : TERMINATED_REASONS[0];
                      setRecordForm(p => ({ ...p, status: nextStatus, resign_reason: defaultReason }));
                    }}
                  >
                    <option value="Resign">Resign (Mengundurkan Diri)</option>
                    <option value="Terminated">Dikeluarkan (Terminated / PHK)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tanggal Efektif Keluar <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    style={inputStyle}
                    required
                    value={recordForm.resign_date}
                    onChange={e => setRecordForm(p => ({ ...p, resign_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  {recordForm.status === 'Resign' ? 'Alasan Mengundurkan Diri' : 'Alasan Dikeluarkan / Diberhentikan'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  style={inputStyle}
                  value={recordForm.resign_reason}
                  onChange={e => setRecordForm(p => ({ ...p, resign_reason: e.target.value }))}
                >
                  {(recordForm.status === 'Resign' ? RESIGN_REASONS : TERMINATED_REASONS).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Kronologi / Keterangan Detail</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '85px', resize: 'vertical' }}
                  placeholder={
                    recordForm.status === 'Resign'
                      ? 'Tuliskan detail alasan mengundurkan diri (contoh: Pindah domisili mengikuti keluarga ke luar kota, serah terima aset konter sudah lengkap)...'
                      : 'Tuliskan detail kenapa dikeluarkan (contoh: Melanggar SOP setoran / mangkir 5 hari berturut-turut tanpa kabar)...'
                  }
                  value={recordForm.resign_notes}
                  onChange={e => setRecordForm(p => ({ ...p, resign_notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: '11px',
                    background: recordForm.status === 'Terminated'
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                  }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan ke Daftar Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Alasan / Status Keluar */}
      {editingEmp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            backdropFilter: 'blur(6px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--bg-surface-opaque)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Edit Detail Resign / Dikeluarkan
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                {editingEmp.name} {editingEmp.branch_name ? `· ${editingEmp.branch_name}` : ''}
              </p>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Status Keluar <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    style={inputStyle}
                    value={editForm.status}
                    onChange={e => {
                      const nextStatus = e.target.value;
                      const defaultReason = nextStatus === 'Resign' ? RESIGN_REASONS[0] : TERMINATED_REASONS[0];
                      setEditForm(p => ({ ...p, status: nextStatus, resign_reason: defaultReason }));
                    }}
                  >
                    <option value="Resign">Resign (Mengundurkan Diri)</option>
                    <option value="Terminated">Dikeluarkan (Terminated)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tanggal Keluar <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    style={inputStyle}
                    required
                    value={editForm.resign_date}
                    onChange={e => setEditForm(p => ({ ...p, resign_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Kategori Alasan <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  style={inputStyle}
                  value={editForm.resign_reason}
                  onChange={e => setEditForm(p => ({ ...p, resign_reason: e.target.value }))}
                >
                  {(editForm.status === 'Resign' ? RESIGN_REASONS : TERMINATED_REASONS).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Kronologi / Keterangan Detail</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                  placeholder="Tuliskan alasan atau kronologi lengkap..."
                  value={editForm.resign_notes}
                  onChange={e => setEditForm(p => ({ ...p, resign_notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: '11px',
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    fontSize: '14px',
                  }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
