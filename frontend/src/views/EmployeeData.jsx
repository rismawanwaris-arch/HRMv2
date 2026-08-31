import React, { useState, useEffect, useRef } from 'react';

import { employeeApi, branchApi } from '../services/api';
import { exportEmployeeToPDF } from '../utils/pdfExport';
import EmployeeFormModal from '../components/Employee/EmployeeFormModal';
import EmployeeCardModal from '../components/Employee/EmployeeCardModal';


function EmployeeData({ onSelectCandidate, setView }) {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [selectedEmployeeCard, setSelectedEmployeeCard] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState(null);

  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

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
    } catch (err) {
      setImportMessage({ type: 'error', text: 'Terjadi kesalahan saat import data.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


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
  const [addForm, setAddForm] = useState(emptyForm);
  const f = (key) => (e) => setAddForm(p => ({ ...p, [key]: e.target.value }));

  useEffect(() => { fetchBranches(); }, []);
  useEffect(() => { fetchEmployees(); }, [search, contractFilter, branchFilter]);

  const fetchBranches = async () => {
    try {
      const data = await branchApi.getAll();
      if (data.success) setBranches(data.data);
    } catch (err) { console.error('Error fetching branches:', err); }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (contractFilter) queryParams.append('contract_type', contractFilter);
      if (branchFilter) queryParams.append('branch_id', branchFilter);
      const data = await employeeApi.getAll(Object.fromEntries(queryParams.entries()));
      if (data.success) setEmployees(data.data);
      else setError(data.message || 'Gagal memuat data karyawan.');
    } catch (err) {
      setError(err.message || 'Gagal memuat data karyawan dari server.');
    } finally { setLoading(false); }
  };

  const handleAddManual = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.name.trim()) { setAddError('Nama karyawan wajib diisi.'); return; }
    try {
      setSubmitting(true);
      const payload = {
          ...addForm,
          branch_id: addForm.branch_id ? parseInt(addForm.branch_id) : null,
          salary_offered: addForm.salary_offered ? parseFloat(addForm.salary_offered) : 0,
          allowance: addForm.allowance ? parseFloat(addForm.allowance) : 0,
          dependents: addForm.dependents ? parseInt(addForm.dependents) : 0,
          height: addForm.height ? parseInt(addForm.height) : null,
          weight: addForm.weight ? parseInt(addForm.weight) : null,
      };
      let data;
      if (editEmployeeId) {
        data = await employeeApi.update(editEmployeeId, payload);
      } else {
        data = await employeeApi.addManual(payload);
      }
      if (data.success) {
        setShowAddModal(false);
        setEditEmployeeId(null);
        setAddForm(emptyForm);
        fetchEmployees();
      } else {
        setAddError(data.message || (editEmployeeId ? 'Gagal mengubah data karyawan.' : 'Gagal menambahkan karyawan.'));
      }
    } catch (err) {
      setAddError('Gagal terhubung ke server.');
    } finally { setSubmitting(false); }
  };

  const handleEditClick = (emp, e) => {
    e.stopPropagation();
    setEditEmployeeId(emp.id);
    setAddForm({
      name: emp.name || '', nik: emp.nik || '', gender: emp.gender || '', birth_place: emp.birth_place || '', birth_date: emp.birth_date ? emp.birth_date.split('T')[0] : '', religion: emp.religion || '',
      marital_status: emp.marital_status || '', dependents: emp.dependents || '', blood_type: emp.blood_type || '',
      phone: emp.phone || '', email: emp.email || '', address_ktp: emp.address_ktp || '', address_domicile: emp.address_domicile || '',
      emergency_contact_1: emp.emergency_contact_1 || '', emergency_contact_2: emp.emergency_contact_2 || '',
      father_name: emp.father_name || '', mother_name: emp.mother_name || '', spouse_name: emp.spouse_name || '',
      education_level: emp.education_level || '', education_institution: emp.education_institution || '', education_major: emp.education_major || '', education_years: emp.education_years || '', education_grade: emp.education_grade || '',
      height: emp.height || '', weight: emp.weight || '', physical_condition: emp.physical_condition || 'Sehat', color_blind_test: emp.color_blind_test || 'Normal', health_history: emp.health_history || '', allergies: emp.allergies || '',
      npwp: emp.npwp || '', bank_name: emp.bank_name || '', bank_account: emp.bank_account || '', bpjs_health: emp.bpjs_health || '', bpjs_employment: emp.bpjs_employment || '', uniform_size: emp.uniform_size || '',
      branch_id: emp.branch_id || '', hire_date: emp.start_date || emp.hire_date ? (emp.start_date || emp.hire_date).split('T')[0] : '', contract_type: emp.contract_type || 'PKWT', salary_offered: emp.salary_offered || '', allowance: emp.allowance || ''
    });
    setShowAddModal(true);
  };

  const handleExportPDF = (emp, e) => { e.stopPropagation(); exportEmployeeToPDF(emp); };


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
                <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
          />
          <button 
            className="btn btn-secondary" 
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={importing}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Mengimpor...' : 'Import Excel'}
          </button>
          <button className="btn btn-primary" onClick={() => { setShowAddModal(true); setAddError(''); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Karyawan Lama
          </button>
        </div>
      </div>

      
      {importMessage && (
        <div style={{ padding: '15px', borderRadius: '8px', marginBottom: '20px', backgroundColor: importMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: importMessage.type === 'success' ? '#047857' : '#b91c1c', border: `1px solid ${importMessage.type === 'success' ? '#10b981' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{importMessage.text}</span>
            <button onClick={() => setImportMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>&times;</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="stat-card-title">Total Karyawan</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{totalEmployees}</div>
          <div className="stat-card-desc">Status Hired dalam database</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
          <div className="stat-card-title">Kontrak PKWT</div>
          <div className="stat-card-value" style={{ color: 'var(--color-info)' }}>{pkwtCount}</div>
          <div className="stat-card-desc">Pegawai Kontrak / Percobaan</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
          <div className="stat-card-title">Pegawai Tetap (PKWTT)</div>
          <div className="stat-card-value" style={{ color: '#a855f7' }}>{pkwttCount}</div>
          <div className="stat-card-desc">Pegawai Tetap Perusahaan</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
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
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>
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
                    <td style={{ fontWeight: '600', color: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--color-primary), var(--secondary))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '14px', color: 'white'
                        }}>{emp.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div>{emp.name}</div>
                          <div style={{ fontSize: '11px', marginTop: '2px' }}>
                            {emp.is_manual_entry
                              ? <span style={{ color: '#f59e0b' }}>● Karyawan Lama</span>
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
                      {(emp.start_date || emp.hire_date)
                        ? new Date(emp.start_date || emp.hire_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-'}
                    </td>
                    <td>
                      <span className={`badge ${emp.contract_type === 'PKWTT' ? 'badge-hired' : 'badge-active'}`}>
                        {emp.contract_type || 'PKWT'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'white' }}>{formatCurrency(emp.salary_offered)}</div>
                      {emp.allowance > 0 && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>+ {formatCurrency(emp.allowance)}</div>}
                    </td>
                    <td>
                      {emp.is_manual_entry
                        ? <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Karyawan Lama</span>
                        : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {['30', '60', '90'].map(d => {
                              const s = emp[`day_${d}_status`];
                              return <span key={d} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: s === 'Passed' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: s === 'Passed' ? 'var(--color-success)' : 'var(--text-muted)', border: `1px solid ${s === 'Passed' ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}` }}>H-{d}</span>;
                            })}
                          </div>
                        )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                          onClick={(e) => handleExportPDF(emp, e)}
                          title="Download PDF"
                        >
                          PDF
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                          onClick={(e) => handleEditClick(emp, e)}
                        >
                          Edit
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setSelectedEmployeeCard(emp)}>Kartu</button>
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => onSelectCandidate(emp.id)}>Detail</button>
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
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Kartu Data Karyawan</h2>
              <button className="close-btn" onClick={() => setSelectedEmployeeCard(null)}>×</button>
            </div>
            <div style={{ padding: '10px 0' }}>
              {/* Header Card */}
              <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.1))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '24px', color: 'white', boxShadow: '0 4px 14px rgba(59,130,246,0.4)', flexShrink: 0 }}>
                  {selectedEmployeeCard.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', margin: 0, fontWeight: '700', color: 'white' }}>{selectedEmployeeCard.name}</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    NIK: <strong>{selectedEmployeeCard.nik || '-'}</strong> | Kontrak: <strong style={{ color: 'var(--color-primary)' }}>{selectedEmployeeCard.contract_type || 'PKWT'}</strong>
                    {selectedEmployeeCard.branch_name && <> | Cabang: <strong style={{ color: '#f59e0b' }}>{selectedEmployeeCard.branch_name}</strong></>}
                  </p>
                  <p style={{ fontSize: '12px', color: selectedEmployeeCard.is_manual_entry ? '#f59e0b' : 'var(--color-success)', margin: '4px 0 0', fontWeight: '500' }}>
                    {selectedEmployeeCard.is_manual_entry ? '⬆ Karyawan Lama (Input Manual)' : '✓ Karyawan via Rekrutmen'}
                    {(selectedEmployeeCard.start_date || selectedEmployeeCard.hire_date) && (
                      <span style={{ marginLeft: '12px', color: 'rgba(255,255,255,0.5)' }}>
                        Diterima: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {new Date(selectedEmployeeCard.start_date || selectedEmployeeCard.hire_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </strong>
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.5px', marginBottom: '12px' }}>Informasi Pribadi & Kontak</h4>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>No. HP/WA:</span> <strong>{selectedEmployeeCard.phone || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> <strong>{selectedEmployeeCard.email || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Jenis Kelamin:</span> <strong>{selectedEmployeeCard.gender || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>TTL:</span> <strong>{selectedEmployeeCard.birth_place || '-'}, {selectedEmployeeCard.birth_date || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Agama:</span> <strong>{selectedEmployeeCard.religion || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Alamat Domisili:</span> <strong>{selectedEmployeeCard.address_domicile || '-'}</strong></div>
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.5px', marginBottom: '12px' }}>Penggajian & Penempatan</h4>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Cabang/Outlet:</span> <strong style={{ color: '#f59e0b' }}>{selectedEmployeeCard.branch_name || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Tgl Diterima Kerja:</span> <strong style={{ color: 'var(--color-success)' }}>{selectedEmployeeCard.start_date || selectedEmployeeCard.hire_date ? new Date(selectedEmployeeCard.start_date || selectedEmployeeCard.hire_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Gaji Pokok:</span> <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedEmployeeCard.salary_offered)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Tunjangan:</span> <strong>{formatCurrency(selectedEmployeeCard.allowance)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Bank & No Rek:</span> <strong>{selectedEmployeeCard.bank_name || '-'} {selectedEmployeeCard.bank_account || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>NPWP:</span> <strong>{selectedEmployeeCard.npwp || '-'}</strong></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedEmployeeCard(null)}>Tutup</button>
                <button className="btn btn-primary" onClick={() => { const id = selectedEmployeeCard.id; setSelectedEmployeeCard(null); onSelectCandidate(id); }}>Buka Detail Lengkap</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeData;
