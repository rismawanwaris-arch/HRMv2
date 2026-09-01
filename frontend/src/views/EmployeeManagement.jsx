import React, { useState, useEffect, useCallback, useRef } from 'react';
import { staffApi, branchApi, employeeApi } from '../services/api';

const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(n) : '0';

const STATUS_BADGE = {
  Active: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: '● Aktif' },
  Resign: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: '● Resign' },
  Terminated: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: '● Terminated' },
};

const TYPE_BADGE = {
  Frontliner: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  Staff: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
};

const EMPTY_FORM = {
  name: '', nik: '', gender: '', birth_place: '', birth_date: '', religion: '',
  marital_status: '', dependents: 0, blood_type: '', phone: '', email: '',
  address_ktp: '', address_domicile: '', emergency_contact_1: '', emergency_contact_2: '',
  father_name: '', mother_name: '', spouse_name: '', children_data: '',
  education_level: '', education_institution: '', education_major: '', education_years: '', education_grade: '',
  work_experience: '', npwp: '', bank_name: '', bank_account: '', bpjs_health: '', bpjs_employment: '', bpjs_active: 'Tidak Aktif',
  uniform_size: '', health_history: '', allergies: '', medications: '', color_blind_test: '',
  height: '', weight: '', physical_condition: '',
  position: '', employee_type: 'Frontliner', contract_type: 'PKWT', branch_id: '',
  hire_date: '', salary: '', allowance: '',
};

const inputStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px',
  padding: '9px 13px', color: 'var(--text-primary)', fontSize: '13px',
  width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
};
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const gridRow = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' };
const gridRow3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' };

function FormField({ label, required, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
    </div>
  );
}

function SectionTitle({ title, color = '#8b5cf6' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 16px' }}>
      <div style={{ width: '3px', height: '16px', background: color, borderRadius: '2px' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color }}>{title}</span>
    </div>
  );
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', branch_id: '', employee_type: '', status: 'Active' });

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('pekerjaan');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState(null);
  const [deactivateForm, setDeactivateForm] = useState({ status: 'Resign', resign_date: '' });

  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [hiredCandidates, setHiredCandidates] = useState([]);
  const [promoteForm, setPromoteForm] = useState({ candidateId: null, employee_type: 'Frontliner', position: '' });

  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.branch_id) params.branch_id = filters.branch_id;
      if (filters.employee_type) params.employee_type = filters.employee_type;
      if (filters.status) params.status = filters.status;
      const res = await staffApi.getAll(params);
      if (res.success) setEmployees(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { branchApi.getAll().then(r => { if (r.success) setBranches(r.data); }); }, []);

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActiveTab('pekerjaan');
    setFormError('');
    setShowFormModal(true);
  };

  const openEdit = async (emp) => {
    setEditingId(emp.id);
    const res = await staffApi.getById(emp.id);
    if (res.success) {
      const d = res.data;
      setForm({ ...EMPTY_FORM, ...d, salary: d.salary || '', allowance: d.allowance || '', height: d.height || '', weight: d.weight || '', dependents: d.dependents || 0 });
    }
    setActiveTab('pekerjaan');
    setFormError('');
    setShowFormModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Nama karyawan wajib diisi.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const res = editingId
        ? await staffApi.update(editingId, form)
        : await staffApi.create(form);
      if (res.success) {
        setShowFormModal(false);
        fetchEmployees();
      } else {
        setFormError(res.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      setFormError(err.message || 'Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (e) => {
    e.preventDefault();
    if (!deactivateForm.resign_date) { alert('Tanggal wajib diisi.'); return; }
    try {
      const res = await staffApi.deactivate(deactivatingEmployee.id, deactivateForm);
      if (res.success) {
        setShowDeactivateModal(false);
        fetchEmployees();
      } else {
        alert(res.message);
      }
    } catch { alert('Gagal menyimpan.'); }
  };

  const openPromote = async () => {
    const res = await staffApi.getHiredCandidates();
    if (res.success) setHiredCandidates(res.data);
    setPromoteForm({ candidateId: null, employee_type: 'Frontliner', position: '' });
    setShowPromoteModal(true);
  };

  const handlePromote = async () => {
    if (!promoteForm.candidateId) { alert('Pilih kandidat terlebih dahulu.'); return; }
    try {
      const res = await staffApi.promote(promoteForm.candidateId, { employee_type: promoteForm.employee_type, position: promoteForm.position });
      if (res.success) {
        setShowPromoteModal(false);
        fetchEmployees();
      } else {
        alert(res.message);
      }
    } catch (err) { alert(err.message || 'Gagal mempromosikan karyawan.'); }
  };

  const tabs = [
    { id: 'pekerjaan', label: 'Data Pekerjaan' },
    { id: 'pribadi', label: 'Data Pribadi' },
    { id: 'pendidikan', label: 'Pendidikan' },
    { id: 'keuangan', label: 'Keuangan & Admin' },
  ];

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    setImportMessage(null);
    try {
      const data = await employeeApi.importExcel(formData);
      if (data.success) {
        setImportMessage({ type: 'success', text: data.message });
        fetchEmployees();
      } else {
        setImportMessage({ type: 'error', text: data.message });
      }
    } catch {
      setImportMessage({ type: 'error', text: 'Terjadi kesalahan saat import data.' });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const activeBranches = branches.filter(b => b.status === 'Active');
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const frontlinerCount = employees.filter(e => e.employee_type === 'Frontliner' && e.status === 'Active').length;
  const staffCount = employees.filter(e => e.employee_type === 'Staff' && e.status === 'Active').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Karyawan</h1>
          <p className="page-subtitle">Kelola data karyawan aktif, promosi, dan status karyawan.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={importRef} onChange={handleImportExcel} />
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const resp = await employeeApi.downloadTemplate();
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'template_import_karyawan.xlsx'; a.click();
                URL.revokeObjectURL(url);
              } catch { alert('Gagal mengunduh template.'); }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><line x1="12" y1="15" x2="12" y2="3"/><polyline points="7 10 12 15 17 10"/></svg>
            Template
          </button>
          <button className="btn btn-secondary" onClick={() => importRef.current && importRef.current.click()} disabled={importing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Mengimpor...' : 'Import Excel'}
          </button>
          <button className="btn" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit' }} onClick={openPromote}>
            Promosikan dari Rekrutmen
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            + Tambah Karyawan
          </button>
        </div>
      </div>

      {importMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: importMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: importMessage.type === 'success' ? '#047857' : '#b91c1c', border: `1px solid ${importMessage.type === 'success' ? '#10b981' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{importMessage.text}</span>
            <button onClick={() => setImportMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' }}>&times;</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        {[
          { label: 'Total Aktif', value: activeCount, color: '#10b981' },
          { label: 'Frontliner', value: frontlinerCount, color: '#3b82f6' },
          { label: 'Staff', value: staffCount, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="glass-panel stat-card">
            <div className="stat-card-title">{s.label}</div>
            <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, width: '220px' }} placeholder="Cari nama, NIK, HP..."
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
        />
        <select style={{ ...inputStyle, width: '160px' }} value={filters.branch_id} onChange={e => setFilters(p => ({ ...p, branch_id: e.target.value }))}>
          <option value="">Semua Cabang</option>
          {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select style={{ ...inputStyle, width: '140px' }} value={filters.employee_type} onChange={e => setFilters(p => ({ ...p, employee_type: e.target.value }))}>
          <option value="">Semua Tipe</option>
          <option value="Frontliner">Frontliner</option>
          <option value="Staff">Staff</option>
        </select>
        <select style={{ ...inputStyle, width: '130px' }} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">Semua Status</option>
          <option value="Active">Aktif</option>
          <option value="Resign">Resign</option>
          <option value="Terminated">Terminated</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />Memuat data karyawan...
          </div>
        ) : employees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Tidak ada data karyawan</p>
            <p style={{ fontSize: '13px' }}>Klik <strong>"+ Tambah Karyawan"</strong> atau <strong>"Promosikan dari Rekrutmen"</strong>.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>Tipe</th>
                  <th>Cabang</th>
                  <th>Kontrak</th>
                  <th>Gaji Pokok</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const statusStyle = STATUS_BADGE[emp.status] || STATUS_BADGE.Active;
                  const typeStyle = TYPE_BADGE[emp.employee_type] || TYPE_BADGE.Frontliner;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp.phone || '-'}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{emp.position || '-'}</td>
                      <td>
                        <span style={{ background: typeStyle.bg, color: typeStyle.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                          {emp.employee_type}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{emp.branch_name || '-'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{emp.contract_type || '-'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                        {emp.salary ? `Rp ${fmt(emp.salary)}` : '-'}
                      </td>
                      <td>
                        <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(emp)}
                          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>
                          Edit
                        </button>
                        {emp.status === 'Active' && (
                          <button onClick={() => { setDeactivatingEmployee(emp); setDeactivateForm({ status: 'Resign', resign_date: '' }); setShowDeactivateModal(true); }}
                            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            Nonaktifkan
                          </button>
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

      {/* Form Modal (Add/Edit) */}
      {showFormModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', overflowY: 'auto', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '780px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: '0 32px 64px rgba(0,0,0,0.3)', marginBottom: '24px' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {editingId ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Lengkapi data karyawan pada tab yang tersedia</p>
              </div>
              <button onClick={() => setShowFormModal(false)} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 28px' }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '13px', fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderBottom: `2px solid ${activeTab === t.id ? 'var(--color-primary)' : 'transparent'}`,
                  marginBottom: '-1px',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Tab: Data Pekerjaan */}
                {activeTab === 'pekerjaan' && (
                  <>
                    <SectionTitle title="Informasi Pekerjaan" color="#8b5cf6" />
                    <FormField label="Nama Lengkap" required>
                      <input style={inputStyle} value={form.name} onChange={f('name')} required />
                    </FormField>
                    <div style={gridRow}>
                      <FormField label="Jabatan / Posisi">
                        <input style={inputStyle} placeholder="Contoh: Kasir, SPV, Staff HRD" value={form.position} onChange={f('position')} />
                      </FormField>
                      <FormField label="Tipe Karyawan">
                        <select style={inputStyle} value={form.employee_type} onChange={f('employee_type')}>
                          <option value="Frontliner">Frontliner</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </FormField>
                    </div>
                    <div style={gridRow}>
                      <FormField label="Tipe Kontrak">
                        <select style={inputStyle} value={form.contract_type} onChange={f('contract_type')}>
                          <option value="PKWT">PKWT</option>
                          <option value="PKWTT">PKWTT</option>
                          <option value="Magang">Magang</option>
                        </select>
                      </FormField>
                      <FormField label="Cabang Penempatan">
                        <select style={inputStyle} value={form.branch_id} onChange={f('branch_id')}>
                          <option value="">-- Pilih Cabang --</option>
                          {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                        </select>
                      </FormField>
                    </div>
                    <div style={gridRow}>
                      <FormField label="Tanggal Mulai Kerja">
                        <input type="date" style={inputStyle} value={form.hire_date} onChange={f('hire_date')} />
                      </FormField>
                    </div>
                    <SectionTitle title="Kompensasi" color="#10b981" />
                    <div style={gridRow}>
                      <FormField label="Gaji Pokok (Rp)">
                        <input type="number" min="0" style={inputStyle} placeholder="0" value={form.salary} onChange={f('salary')} />
                      </FormField>
                      <FormField label="Tunjangan (Rp)">
                        <input type="number" min="0" style={inputStyle} placeholder="0" value={form.allowance} onChange={f('allowance')} />
                      </FormField>
                    </div>
                  </>
                )}

                {/* Tab: Data Pribadi */}
                {activeTab === 'pribadi' && (
                  <>
                    <SectionTitle title="Identitas Diri" color="#3b82f6" />
                    <div style={gridRow}>
                      <FormField label="NIK (KTP)">
                        <input style={inputStyle} maxLength={16} value={form.nik} onChange={f('nik')} />
                      </FormField>
                      <FormField label="Jenis Kelamin">
                        <select style={inputStyle} value={form.gender} onChange={f('gender')}>
                          <option value="">-- Pilih --</option>
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </FormField>
                    </div>
                    <div style={gridRow}>
                      <FormField label="Tempat Lahir">
                        <input style={inputStyle} value={form.birth_place} onChange={f('birth_place')} />
                      </FormField>
                      <FormField label="Tanggal Lahir">
                        <input type="date" style={inputStyle} value={form.birth_date} onChange={f('birth_date')} />
                      </FormField>
                    </div>
                    <div style={gridRow3}>
                      <FormField label="Agama">
                        <select style={inputStyle} value={form.religion} onChange={f('religion')}>
                          <option value="">-- Pilih --</option>
                          {['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Status Perkawinan">
                        <select style={inputStyle} value={form.marital_status} onChange={f('marital_status')}>
                          <option value="">-- Pilih --</option>
                          <option value="Belum Menikah">Belum Menikah</option>
                          <option value="Menikah">Menikah</option>
                          <option value="Cerai">Cerai</option>
                        </select>
                      </FormField>
                      <FormField label="Jumlah Tanggungan">
                        <input type="number" min="0" style={inputStyle} value={form.dependents} onChange={f('dependents')} />
                      </FormField>
                    </div>
                    <div style={gridRow}>
                      <FormField label="No. HP / WhatsApp">
                        <input style={inputStyle} value={form.phone} onChange={f('phone')} />
                      </FormField>
                      <FormField label="Email">
                        <input type="email" style={inputStyle} value={form.email} onChange={f('email')} />
                      </FormField>
                    </div>
                    <FormField label="Alamat KTP">
                      <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.address_ktp} onChange={f('address_ktp')} />
                    </FormField>
                    <FormField label="Alamat Domisili">
                      <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.address_domicile} onChange={f('address_domicile')} />
                    </FormField>
                    <SectionTitle title="Kontak & Keluarga" color="#3b82f6" />
                    <div style={gridRow}>
                      <FormField label="Kontak Darurat 1">
                        <input style={inputStyle} placeholder="Nama & No HP" value={form.emergency_contact_1} onChange={f('emergency_contact_1')} />
                      </FormField>
                      <FormField label="Kontak Darurat 2">
                        <input style={inputStyle} placeholder="Nama & No HP" value={form.emergency_contact_2} onChange={f('emergency_contact_2')} />
                      </FormField>
                    </div>
                    <div style={gridRow3}>
                      <FormField label="Nama Ayah">
                        <input style={inputStyle} value={form.father_name} onChange={f('father_name')} />
                      </FormField>
                      <FormField label="Nama Ibu">
                        <input style={inputStyle} value={form.mother_name} onChange={f('mother_name')} />
                      </FormField>
                      <FormField label="Nama Pasangan">
                        <input style={inputStyle} value={form.spouse_name} onChange={f('spouse_name')} />
                      </FormField>
                    </div>
                  </>
                )}

                {/* Tab: Pendidikan */}
                {activeTab === 'pendidikan' && (
                  <>
                    <SectionTitle title="Pendidikan Terakhir" color="#f59e0b" />
                    <div style={gridRow}>
                      <FormField label="Tingkat Pendidikan">
                        <select style={inputStyle} value={form.education_level} onChange={f('education_level')}>
                          <option value="">-- Pilih --</option>
                          {['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Nama Institusi">
                        <input style={inputStyle} value={form.education_institution} onChange={f('education_institution')} />
                      </FormField>
                    </div>
                    <div style={gridRow3}>
                      <FormField label="Jurusan">
                        <input style={inputStyle} value={form.education_major} onChange={f('education_major')} />
                      </FormField>
                      <FormField label="Tahun Lulus">
                        <input style={inputStyle} value={form.education_years} onChange={f('education_years')} />
                      </FormField>
                      <FormField label="Nilai / IPK">
                        <input style={inputStyle} value={form.education_grade} onChange={f('education_grade')} />
                      </FormField>
                    </div>
                    <SectionTitle title="Fisik & Kesehatan" color="#f59e0b" />
                    <div style={gridRow3}>
                      <FormField label="Tinggi Badan (cm)">
                        <input type="number" style={inputStyle} value={form.height} onChange={f('height')} />
                      </FormField>
                      <FormField label="Berat Badan (kg)">
                        <input type="number" style={inputStyle} value={form.weight} onChange={f('weight')} />
                      </FormField>
                      <FormField label="Golongan Darah">
                        <select style={inputStyle} value={form.blood_type} onChange={f('blood_type')}>
                          <option value="">--</option>
                          {['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </FormField>
                    </div>
                    <div style={gridRow}>
                      <FormField label="Kondisi Fisik">
                        <input style={inputStyle} placeholder="Contoh: Sehat, tidak ada cacat fisik" value={form.physical_condition} onChange={f('physical_condition')} />
                      </FormField>
                      <FormField label="Tes Buta Warna">
                        <select style={inputStyle} value={form.color_blind_test} onChange={f('color_blind_test')}>
                          <option value="">-- Pilih --</option>
                          <option value="Normal">Normal</option>
                          <option value="Buta Warna Sebagian">Buta Warna Sebagian</option>
                          <option value="Buta Warna Total">Buta Warna Total</option>
                        </select>
                      </FormField>
                    </div>
                    <FormField label="Riwayat Penyakit">
                      <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.health_history} onChange={f('health_history')} />
                    </FormField>
                    <div style={gridRow}>
                      <FormField label="Alergi">
                        <input style={inputStyle} value={form.allergies} onChange={f('allergies')} />
                      </FormField>
                      <FormField label="Obat Rutin">
                        <input style={inputStyle} value={form.medications} onChange={f('medications')} />
                      </FormField>
                    </div>
                    <FormField label="Ukuran Seragam">
                      <select style={{ ...inputStyle, width: 'auto' }} value={form.uniform_size} onChange={f('uniform_size')}>
                        <option value="">-- Pilih --</option>
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </FormField>
                  </>
                )}

                {/* Tab: Keuangan & Administrasi */}
                {activeTab === 'keuangan' && (
                  <>
                    <SectionTitle title="Data Perpajakan" color="#ef4444" />
                    <FormField label="NPWP">
                      <input style={inputStyle} placeholder="XX.XXX.XXX.X-XXX.XXX" value={form.npwp} onChange={f('npwp')} />
                    </FormField>
                    <SectionTitle title="Rekening Bank" color="#ef4444" />
                    <div style={gridRow}>
                      <FormField label="Nama Bank">
                        <input style={inputStyle} placeholder="BCA, BRI, Mandiri, dll" value={form.bank_name} onChange={f('bank_name')} />
                      </FormField>
                      <FormField label="Nomor Rekening">
                        <input style={inputStyle} value={form.bank_account} onChange={f('bank_account')} />
                      </FormField>
                    </div>
                    <SectionTitle title="BPJS" color="#ef4444" />
                    <div style={gridRow}>
                      <FormField label="Nomor BPJS Kesehatan">
                        <input style={inputStyle} value={form.bpjs_health} onChange={f('bpjs_health')} />
                      </FormField>
                      <FormField label="Nomor BPJS Ketenagakerjaan">
                        <input style={inputStyle} value={form.bpjs_employment} onChange={f('bpjs_employment')} />
                      </FormField>
                    </div>
                    <FormField label="Status BPJS">
                      <select style={{ ...inputStyle, width: 'auto' }} value={form.bpjs_active} onChange={f('bpjs_active')}>
                        <option value="Aktif">Aktif</option>
                        <option value="Tidak Aktif">Tidak Aktif</option>
                      </select>
                    </FormField>
                  </>
                )}
              </div>

              {formError && (
                <div style={{ margin: '0 28px 16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {formError}
                </div>
              )}

              <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowFormModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '14px' }}>
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  style={{ flex: 2, padding: '12px', background: submitting ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '12px', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px' }}>
                  {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && deactivatingEmployee && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Nonaktifkan Karyawan</h3>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{deactivatingEmployee.name}</p>
            </div>
            <form onSubmit={handleDeactivate} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField label="Alasan Keluar">
                <select style={inputStyle} value={deactivateForm.status} onChange={e => setDeactivateForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="Resign">Resign (mengundurkan diri)</option>
                  <option value="Terminated">Terminated (diberhentikan)</option>
                </select>
              </FormField>
              <FormField label="Tanggal Keluar" required>
                <input type="date" style={inputStyle} required value={deactivateForm.resign_date} onChange={e => setDeactivateForm(p => ({ ...p, resign_date: e.target.value }))} />
              </FormField>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowDeactivateModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '14px' }}>
                  Batal
                </button>
                <button type="submit"
                  style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px' }}>
                  Nonaktifkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote Modal */}
      {showPromoteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Promosikan dari Rekrutmen</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Pilih kandidat Hired untuk dijadikan karyawan</p>
              </div>
              <button onClick={() => setShowPromoteModal(false)} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '24px 28px' }}>
              <div style={{ marginBottom: '16px', maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                {hiredCandidates.filter(c => !c.already_promoted).length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '13px' }}>Semua kandidat Hired sudah dipromosikan.</p>
                ) : hiredCandidates.filter(c => !c.already_promoted).map(c => (
                  <div key={c.id}
                    onClick={() => setPromoteForm(p => ({ ...p, candidateId: c.id }))}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                      background: promoteForm.candidateId === c.id ? 'rgba(139,92,246,0.1)' : 'transparent',
                      transition: 'background 0.15s',
                    }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {c.branch_name || 'Belum ada cabang'} · {c.contract_type || 'PKWT'}
                    </div>
                  </div>
                ))}
              </div>
              {promoteForm.candidateId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <FormField label="Tipe Karyawan">
                    <select style={inputStyle} value={promoteForm.employee_type} onChange={e => setPromoteForm(p => ({ ...p, employee_type: e.target.value }))}>
                      <option value="Frontliner">Frontliner</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </FormField>
                  <FormField label="Jabatan">
                    <input style={inputStyle} placeholder="Contoh: Kasir" value={promoteForm.position} onChange={e => setPromoteForm(p => ({ ...p, position: e.target.value }))} />
                  </FormField>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowPromoteModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '14px' }}>
                  Batal
                </button>
                <button type="button" onClick={handlePromote} disabled={!promoteForm.candidateId}
                  style={{ flex: 2, padding: '12px', background: promoteForm.candidateId ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(16,185,129,0.3)', border: 'none', borderRadius: '10px', color: 'white', cursor: promoteForm.candidateId ? 'pointer' : 'not-allowed', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px' }}>
                  Promosikan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
