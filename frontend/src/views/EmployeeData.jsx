import React, { useState, useEffect, useRef, useCallback } from 'react';
import { employeeApi, branchApi } from '../services/api';
import { exportEmployeeToPDF } from '../utils/pdfExport';
import EmployeeFormModal from '../components/Employee/EmployeeFormModal';
import EmployeeCardModal from '../components/Employee/EmployeeCardModal';

const emptyForm = {
  // Identitas
  name: '', nik: '', gender: '', birth_place: '', birth_date: '', religion: '',
  marital_status: '', dependents: '', blood_type: '',
  // Kontak
  phone: '', email: '', address_ktp: '', address_domicile: '',
  emergency_contact_1: '', emergency_contact_2: '',
  // Keluarga
  father_name: '', mother_name: '', spouse_name: '',
  // Pendidikan
  education_level: '', education_institution: '', education_major: '', education_years: '', education_grade: '',
  // Fisik & Kesehatan
  height: '', weight: '', physical_condition: 'Sehat', color_blind_test: 'Normal', health_history: '', allergies: '',
  // Administrasi
  npwp: '', bank_name: '', bank_account: '', bpjs_health: '', bpjs_employment: '', uniform_size: '',
  // Penempatan & Kontrak
  branch_id: '', hire_date: '', contract_type: 'PKWT', salary_offered: '', allowance: ''
};

function safeFormatDateId(val) {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EmployeeData({ onSelectCandidate, canAccess }) {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [selectedEmployeeCard, setSelectedEmployeeCard] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState(null);
  const [addForm, setAddForm] = useState(emptyForm);

  const fileInputRef = useRef(null);
  const fetchReqIdRef = useRef(0);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBranches = useCallback(async () => {
    try {
      const data = await branchApi.getAll();
      if (data.success) setBranches(data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchEmployees = useCallback(async () => {
    const reqId = ++fetchReqIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (contractFilter) params.contract_type = contractFilter;
      if (branchFilter) params.branch_id = branchFilter;
      const data = await employeeApi.getAll(params);
      if (reqId !== fetchReqIdRef.current) return;
      if (data.success) setEmployees(data.data || []);
      else setError(data.message || 'Gagal memuat data karyawan.');
    } catch (err) {
      if (reqId !== fetchReqIdRef.current) return;
      setError(err.message || 'Gagal memuat data karyawan dari server.');
    } finally {
      if (reqId === fetchReqIdRef.current) setLoading(false);
    }
  }, [debouncedSearch, contractFilter, branchFilter]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

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
        const errDetail = data.errors && data.errors.length > 0
          ? ` (${data.errors.slice(0, 3).join('; ')}${data.errors.length > 3 ? '...' : ''})`
          : '';
        setImportMessage({ type: data.errors && data.errors.length > 0 ? 'error' : 'success', text: data.message + errDetail });
        fetchEmployees();
        fetchBranches();
      } else {
        setImportMessage({ type: 'error', text: data.message || 'Gagal mengimpor data.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: err.message || 'Terjadi kesalahan saat import data.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManual = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.name.trim()) { setAddError('Nama karyawan wajib diisi.'); return; }
    try {
      setSubmitting(true);
      const payload = {
        ...addForm,
        branch_id: addForm.branch_id ? parseInt(addForm.branch_id, 10) : null,
        salary_offered: addForm.salary_offered ? parseFloat(addForm.salary_offered) : 0,
        allowance: addForm.allowance ? parseFloat(addForm.allowance) : 0,
        dependents: addForm.dependents ? parseInt(addForm.dependents, 10) : 0,
        height: addForm.height ? parseInt(addForm.height, 10) : null,
        weight: addForm.weight ? parseInt(addForm.weight, 10) : null,
      };
      const data = editEmployeeId
        ? await employeeApi.update(editEmployeeId, payload)
        : await employeeApi.addManual(payload);
      if (data.success) {
        setShowAddModal(false);
        setEditEmployeeId(null);
        setAddForm(emptyForm);
        fetchEmployees();
      } else {
        setAddError(data.message || (editEmployeeId ? 'Gagal mengubah data karyawan.' : 'Gagal menambahkan karyawan.'));
      }
    } catch (err) {
      setAddError(err.message || 'Gagal terhubung ke server.');
    } finally { setSubmitting(false); }
  };

  const handleEditClick = (emp, e) => {
    e.stopPropagation();
    const rawHire = emp.start_date || emp.hire_date;
    setEditEmployeeId(emp.id);
    setAddError('');
    setAddForm({
      name: emp.name || '', nik: emp.nik || '', gender: emp.gender || '', birth_place: emp.birth_place || '', birth_date: emp.birth_date ? String(emp.birth_date).slice(0, 10) : '', religion: emp.religion || '',
      marital_status: emp.marital_status || '', dependents: emp.dependents || '', blood_type: emp.blood_type || '',
      phone: emp.phone || '', email: emp.email || '', address_ktp: emp.address_ktp || '', address_domicile: emp.address_domicile || '',
      emergency_contact_1: emp.emergency_contact_1 || '', emergency_contact_2: emp.emergency_contact_2 || '',
      father_name: emp.father_name || '', mother_name: emp.mother_name || '', spouse_name: emp.spouse_name || '',
      education_level: emp.education_level || '', education_institution: emp.education_institution || '', education_major: emp.education_major || '', education_years: emp.education_years || '', education_grade: emp.education_grade || '',
      height: emp.height || '', weight: emp.weight || '', physical_condition: emp.physical_condition || 'Sehat', color_blind_test: emp.color_blind_test || 'Normal', health_history: emp.health_history || '', allergies: emp.allergies || '',
      npwp: emp.npwp || '', bank_name: emp.bank_name || '', bank_account: emp.bank_account || '', bpjs_health: emp.bpjs_health || '', bpjs_employment: emp.bpjs_employment || '', uniform_size: emp.uniform_size || '',
      branch_id: emp.branch_id || '', hire_date: rawHire ? String(rawHire).slice(0, 10) : '', contract_type: emp.contract_type || 'PKWT', salary_offered: emp.salary_offered || '', allowance: emp.allowance || ''
    });
    setShowAddModal(true);
  };

  const handleExportPDF = async (emp, e) => {
    e.stopPropagation();
    try {
      await exportEmployeeToPDF(emp);
    } catch (err) {
      alert('Gagal membuat PDF: ' + (err?.message || 'Kesalahan tidak diketahui'));
    }
  };

  const totalEmployees = employees.length;
  const pkwtCount = employees.filter(e => e.contract_type === 'PKWT').length;
  const pkwttCount = employees.filter(e => e.contract_type === 'PKWTT').length;
  const onboardingPassed = employees.filter(e => e.day_90_status === 'Passed').length;

  const formatCurrency = (val) => {
    if (!val) return 'Rp 0';
    return 'Rp ' + Number(val).toLocaleString('id-ID');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Karyawan (Hired)</h1>
          <p className="page-subtitle">Daftar lengkap karyawan yang telah diterima bekerja dan masuk dalam database perusahaan.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <button
            type="button"
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><line x1="12" y1="15" x2="12" y2="3"/><polyline points="7 10 12 15 17 10"/></svg>
            Template
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={importing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Mengimpor...' : 'Import Excel'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditEmployeeId(null);
              setAddForm(emptyForm);
              setAddError('');
              setShowAddModal(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Karyawan Lama
          </button>
        </div>
      </div>

      {importMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', backgroundColor: importMessage.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: importMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', border: `1px solid ${importMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`, fontSize: '13px', fontWeight: 500 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span>{importMessage.text}</span>
            <button type="button" onClick={() => setImportMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '18px', lineHeight: 1 }}>&times;</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Total Karyawan</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{totalEmployees}</div>
          <div className="stat-card-desc">Status Hired dalam database</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Kontrak PKWT</div>
          <div className="stat-card-value" style={{ color: 'var(--color-info)' }}>{pkwtCount}</div>
          <div className="stat-card-desc">Pegawai Kontrak / Percobaan</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Pegawai Tetap (PKWTT)</div>
          <div className="stat-card-value" style={{ color: 'var(--color-primary)' }}>{pkwttCount}</div>
          <div className="stat-card-desc">Pegawai Tetap Perusahaan</div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Lolos Onboarding 90 Hari</div>
          <div className="stat-card-value" style={{ color: 'var(--color-warning)' }}>{onboardingPassed}</div>
          <div className="stat-card-desc">Selesai masa pemantauan awal</div>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flexGrow: 1, minWidth: '240px' }}>
          <input type="text" placeholder="Cari nama, NIK, No. HP, atau cabang..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ minWidth: '180px' }}>
          <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
            <option value="">Semua Tipe Kontrak</option>
            <option value="PKWT">PKWT (Kontrak)</option>
            <option value="PKWTT">PKWTT (Tetap)</option>
          </select>
        </div>
        <div style={{ minWidth: '180px' }}>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="">Semua Cabang</option>
            {branches.map(b => (<option key={b.id} value={b.id}>{b.code} — {b.name}</option>))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-danger)' }}>
            <p style={{ marginBottom: '12px' }}>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={fetchEmployees}>Coba Lagi</button>
          </div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.4 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>Belum ada karyawan.</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gunakan tombol <strong>"Tambah Karyawan Lama"</strong> untuk menambahkan data karyawan yang sudah ada sebelum sistem ini dibuat.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Karyawan</th>
                  <th>NIK</th>
                  <th>Cabang</th>
                  <th>Kontak</th>
                  <th>Mulai Bekerja</th>
                  <th>Tipe Kontrak</th>
                  <th>Gaji</th>
                  <th>Onboarding</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--color-primary), var(--secondary))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '14px', color: 'white'
                        }}>{(emp.name || '?').charAt(0).toUpperCase()}</div>
                        <div>
                          <div>{emp.name}</div>
                          <div style={{ fontSize: '11px', marginTop: '2px' }}>
                            {emp.is_manual_entry
                              ? <span style={{ color: 'var(--color-warning)' }}>● Karyawan Lama</span>
                              : <span style={{ color: 'var(--color-success)' }}>● Via Rekrutmen</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{emp.nik || '-'}</td>
                    <td>
                      {emp.branch_name ? (
                        <div>
                          <span style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, display: 'block', marginBottom: '2px' }}>{emp.branch_code}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{emp.branch_name}</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>-</span>}
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>{emp.phone || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.email || '-'}</div>
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {safeFormatDateId(emp.start_date || emp.hire_date)}
                    </td>
                    <td>
                      <span className={`badge ${emp.contract_type === 'PKWTT' ? 'badge-hired' : 'badge-active'}`}>
                        {emp.contract_type || 'PKWT'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{formatCurrency(emp.salary_offered)}</div>
                      {emp.allowance > 0 && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>+ {formatCurrency(emp.allowance)}</div>}
                    </td>
                    <td>
                      {emp.is_manual_entry
                        ? <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Karyawan Lama</span>
                        : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['30', '60', '90'].map(d => {
                              const s = emp[`day_${d}_status`];
                              return <span key={d} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: s === 'Passed' ? 'var(--color-success-bg)' : 'var(--bg-secondary)', color: s === 'Passed' ? 'var(--color-success)' : 'var(--text-muted)', border: `1px solid ${s === 'Passed' ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}` }}>H-{d}</span>;
                            })}
                          </div>
                        )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                          onClick={(e) => handleExportPDF(emp, e)}
                          title="Download PDF"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid rgba(59, 130, 246, 0.25)' }}
                          onClick={(e) => handleEditClick(emp, e)}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setSelectedEmployeeCard(emp)}>Kartu</button>
                        {(canAccess?.rekrutmen ?? true) && onSelectCandidate && (
                          <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => onSelectCandidate(emp.id)}>Detail</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <EmployeeFormModal
          editEmployeeId={editEmployeeId}
          addError={addError}
          submitting={submitting}
          handleAddManual={handleAddManual}
          addForm={addForm}
          setAddForm={setAddForm}
          setShowAddModal={setShowAddModal}
          setEditEmployeeId={setEditEmployeeId}
          setAddError={setAddError}
          emptyForm={emptyForm}
          branches={branches}
        />
      )}

      {/* Employee Detail Card Modal */}
      {selectedEmployeeCard && (
        <EmployeeCardModal emp={selectedEmployeeCard} onClose={() => setSelectedEmployeeCard(null)} />
      )}
    </div>
  );
}

export default EmployeeData;
