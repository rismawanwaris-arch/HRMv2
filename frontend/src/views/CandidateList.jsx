import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { candidateApi, stageApi } from '../services/api';
import { exportCandidateToPDF } from '../utils/pdfExport';

const EMPTY_CANDIDATE_FORM = {
  name: '', nik: '', email: '', phone: '', gender: 'Laki-laki', birth_place: '', birth_date: '',
  religion: '', marital_status: 'Belum Kawin', dependents: 0, blood_type: '', height: '', weight: '',
  physical_condition: 'Sehat', address_ktp: '', address_domicile: '',
  emergency_contact_1: '', emergency_contact_2: '',
  father_name: '', mother_name: '', spouse_name: '', children_data: '',
  education_level: 'SMA / SMK', education_institution: '', education_major: '', education_years: '', education_grade: '',
  work_experience: '', npwp: '', bank_account: '', bank_name: '',
  bpjs_health: '', bpjs_employment: '', bpjs_active: 'Tidak Aktif', uniform_size: '',
  health_history: '', allergies: '', medications: '', color_blind_test: 'Normal',
  status: 'Active', current_stage: 1
};

const safeFormatDateId = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

function CandidateList({ onSelectCandidate, setView }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('pribadi');
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_CANDIDATE_FORM);

  const [stages, setStages] = useState([]);
  const fetchReqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setEditingCandidateId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  const fetchStages = useCallback(async () => {
    try {
      const data = await stageApi.getAll();
      if (data.success) {
        setStages((data.data || []).filter(s => s.is_active === 1));
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  const fetchCandidates = useCallback(async () => {
    const reqId = ++fetchReqIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (stageFilter) params.stage = stageFilter;

      const data = await candidateApi.getAll(params);
      if (reqId !== fetchReqIdRef.current) return;
      if (data.success) {
        setCandidates(data.data || []);
      } else {
        setError(data.message || 'Gagal memuat daftar pelamar.');
      }
    } catch (err) {
      if (reqId !== fetchReqIdRef.current) return;
      setError(err.message || 'Gagal memuat daftar pelamar.');
    } finally {
      if (reqId === fetchReqIdRef.current) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, stageFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenEditModal = async (candidate, e) => {
    if (e) e.stopPropagation();
    let full = candidate;
    try {
      const res = await candidateApi.getById(candidate.id);
      if (res.success && res.data?.candidate) {
        full = res.data.candidate;
      }
    } catch {
      /* fallback to row summary if single fetch fails */
    }
    setEditingCandidateId(full.id);
    setFormData({
      name: full.name || '',
      nik: full.nik || '',
      email: full.email || '',
      phone: full.phone || '',
      gender: full.gender || 'Laki-laki',
      birth_place: full.birth_place || '',
      birth_date: full.birth_date ? String(full.birth_date).slice(0, 10) : '',
      religion: full.religion || '',
      marital_status: full.marital_status || 'Belum Kawin',
      dependents: full.dependents || 0,
      blood_type: full.blood_type || '',
      height: full.height || '',
      weight: full.weight || '',
      physical_condition: full.physical_condition || 'Sehat',
      address_ktp: full.address_ktp || '',
      address_domicile: full.address_domicile || '',
      emergency_contact_1: full.emergency_contact_1 || '',
      emergency_contact_2: full.emergency_contact_2 || '',
      father_name: full.father_name || '',
      mother_name: full.mother_name || '',
      spouse_name: full.spouse_name || '',
      children_data: full.children_data || '',
      education_level: full.education_level || 'SMA / SMK',
      education_institution: full.education_institution || '',
      education_major: full.education_major || '',
      education_years: full.education_years || '',
      education_grade: full.education_grade || '',
      work_experience: full.work_experience || '',
      npwp: full.npwp || '',
      bank_account: full.bank_account || '',
      bank_name: full.bank_name || '',
      bpjs_health: full.bpjs_health || '',
      bpjs_employment: full.bpjs_employment || '',
      bpjs_active: full.bpjs_active || 'Tidak Aktif',
      uniform_size: full.uniform_size || '',
      health_history: full.health_history || '',
      allergies: full.allergies || '',
      medications: full.medications || '',
      color_blind_test: full.color_blind_test || 'Normal',
      status: full.status || 'Active',
      current_stage: full.current_stage || 1
    });
    setModalTab('pribadi');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setModalTab('pribadi');
      alert('Nama lengkap wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      const data = editingCandidateId
        ? await candidateApi.update(editingCandidateId, formData)
        : await candidateApi.create(formData);

      if (data.success) {
        if (editingCandidateId) {
          alert('Profil pelamar berhasil diperbarui!');
        } else {
          alert(`Kandidat berhasil ditambahkan!\nKode Akses Ujian: ${data.accessCode}`);
        }
        setIsModalOpen(false);
        setEditingCandidateId(null);
        setFormData(EMPTY_CANDIDATE_FORM);
        setModalTab('pribadi');
        fetchCandidates();
      } else {
        alert(data.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan koneksi ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingCandidateId(null);
    setFormData(EMPTY_CANDIDATE_FORM);
    setModalTab('pribadi');
    setIsModalOpen(true);
  };

  const handleDeleteCandidate = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kandidat "${name}"? Semua data tahapan evaluasi akan ikut terhapus.`)) {
      return;
    }

    try {
      const data = await candidateApi.delete(id);
      if (data.success) {
        fetchCandidates();
      } else {
        alert(data.message || 'Gagal menghapus kandidat.');
      }
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan koneksi.');
    }
  };

  const handleExportCandidatePDF = async (candidate, e) => {
    e.stopPropagation();
    let full = candidate;
    try {
      const res = await candidateApi.getById(candidate.id);
      if (res.success && res.data?.candidate) {
        full = res.data.candidate;
      }
    } catch {
      /* fallback */
    }
    try {
      await exportCandidateToPDF(full);
    } catch (err) {
      alert('Gagal membuat PDF: ' + (err?.message || 'Kesalahan tidak diketahui'));
    }
  };

  const eduOptions = ['SD', 'SMP', 'SMA / SMK', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1 / D4', 'S1', 'S2', 'S3'];
  const eduChoices = formData.education_level && !eduOptions.includes(formData.education_level)
    ? [...eduOptions, formData.education_level]
    : eduOptions;
  const maritalOptions = ['Belum Kawin', 'Belum Menikah', 'Kawin', 'Menikah', 'Cerai Hidup', 'Cerai Mati', 'Cerai'];
  const maritalChoices = formData.marital_status && !maritalOptions.includes(formData.marital_status)
    ? [...maritalOptions, formData.marital_status]
    : maritalOptions;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Kelola Pelamar Kerja</h1>
          <p className="page-subtitle">Pencarian, filter, dan penambahan kandidat frontliner.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {setView && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setView('upload-pelamar')}
              style={{
                background: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                borderColor: 'rgba(16, 185, 129, 0.4)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload / Import Pelamar
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Pelamar Manual
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flexGrow: 1, minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ minWidth: '150px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Semua Status</option>
            <option value="Active">Proses Seleksi</option>
            <option value="Hired">Diterima (Hired)</option>
            <option value="Rejected">Gugur (Rejected)</option>
            <option value="Resigned">Resign / Keluar</option>
          </select>
        </div>
        <div style={{ minWidth: '180px' }}>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">Semua Tahap Seleksi</option>
            {stages.map((stage, idx) => (
              <option key={stage.id} value={stage.id}>{idx + 1}. {stage.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-spinner"></div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-danger)' }}>
            <p style={{ marginBottom: '12px' }}>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={fetchCandidates}>Coba Lagi</button>
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Tidak ada pelamar yang cocok dengan kriteria pencarian.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Pelamar</th>
                  <th>NIK</th>
                  <th>Kontak</th>
                  <th>Tahap Saat Ini</th>
                  <th>Status</th>
                  <th>Tanggal Daftar</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSelectCandidate(c.id)}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{c.name}</td>
                    <td>{c.nik || '-'}</td>
                    <td>
                      <div style={{ fontSize: '13px' }}>{c.phone || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email || '-'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: '500' }}>
                        {(() => {
                          const stageConfig = stages.find(s => s.id === c.current_stage);
                          const stageIndex = stageConfig ? stages.indexOf(stageConfig) + 1 : '-';
                          const stageName = stageConfig ? stageConfig.name : `Tahap ${c.current_stage || '-'}`;
                          return `${stageIndex}. ${stageName}`;
                        })()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${(c.status || 'Active').toLowerCase()}`}>
                        {c.status === 'Active' ? 'Seleksi' : (c.status || 'Active')}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {safeFormatDateId(c.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                          onClick={(e) => handleExportCandidatePDF(c, e)}
                          title="Download PDF"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={(e) => { e.stopPropagation(); onSelectCandidate(c.id); }}
                        >
                          Detail Evaluasi
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid rgba(59, 130, 246, 0.25)' }}
                          onClick={(e) => handleOpenEditModal(c, e)}
                        >
                          Edit Profil
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                          onClick={(e) => handleDeleteCandidate(c.id, c.name, e)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Candidate Modal */}
      {isModalOpen && createPortal(
        <div
          className="modal-overlay"
          style={{ zIndex: 3000, overscrollBehavior: 'contain' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
              setEditingCandidateId(null);
            }
          }}
        >
          <div className="glass-panel modal-content" style={{ background: 'var(--bg-surface-opaque)', overscrollBehavior: 'contain' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCandidateId ? 'Edit Profil Pelamar Kerja' : 'Form Data Diri Pelamar Baru'}</h2>
              <button type="button" className="close-btn" onClick={() => { setIsModalOpen(false); setEditingCandidateId(null); }}>×</button>
            </div>

            {/* Modal Internal Tabs */}
            <div className="tab-menu" style={{ marginBottom: '20px' }}>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'pribadi' ? 'active' : ''}`}
                onClick={() => setModalTab('pribadi')}
              >
                1. Data Diri & Kontak
              </button>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'pendidikan' ? 'active' : ''}`}
                onClick={() => setModalTab('pendidikan')}
              >
                2. Pendidikan & Keluarga
              </button>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'pekerjaan' ? 'active' : ''}`}
                onClick={() => setModalTab('pekerjaan')}
              >
                3. Pekerjaan & Admin
              </button>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'kesehatan' ? 'active' : ''}`}
                onClick={() => setModalTab('kesehatan')}
              >
                4. Kesehatan
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              {/* Tab 1: Data Diri & Kontak */}
              {modalTab === 'pribadi' && (
                <div className="form-grid">
                  <div className="form-group form-group-full">
                    <label>Nama Lengkap (Sesuai KTP) *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Masukkan nama lengkap kandidat..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>NIK (Nomor Induk Kependudukan)</label>
                    <input
                      type="text"
                      name="nik"
                      value={formData.nik}
                      onChange={handleInputChange}
                      placeholder="320xxxxxxxxxxxxx"
                      maxLength={16}
                    />
                  </div>
                  <div className="form-group">
                    <label>Jenis Kelamin</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange}>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nomor HP (WhatsApp) *</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Pribadi</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="nama@email.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tempat Lahir</label>
                    <input
                      type="text"
                      name="birth_place"
                      value={formData.birth_place}
                      onChange={handleInputChange}
                      placeholder="Kota lahir..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Tanggal Lahir</label>
                    <input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Agama</label>
                    <input
                      type="text"
                      name="religion"
                      value={formData.religion}
                      onChange={handleInputChange}
                      placeholder="Islam, Kristen, dll."
                    />
                  </div>
                  <div className="form-group">
                    <label>Status Perkawinan</label>
                    <select name="marital_status" value={formData.marital_status} onChange={handleInputChange}>
                      {maritalChoices.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group form-group-full">
                    <label>Alamat Domisili Sekarang (Lengkap)</label>
                    <textarea
                      name="address_domicile"
                      value={formData.address_domicile}
                      onChange={handleInputChange}
                      placeholder="Masukkan alamat tinggal saat ini..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Pendidikan & Keluarga */}
              {modalTab === 'pendidikan' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Jenjang Pendidikan Terakhir</label>
                    <select name="education_level" value={formData.education_level} onChange={handleInputChange}>
                      {eduChoices.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nama Sekolah / Universitas</label>
                    <input
                      type="text"
                      name="education_institution"
                      value={formData.education_institution}
                      onChange={handleInputChange}
                      placeholder="Nama SMA/SMK/Kampus..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Jurusan / Program Studi</label>
                    <input
                      type="text"
                      name="education_major"
                      value={formData.education_major}
                      onChange={handleInputChange}
                      placeholder="IPA, IPS, Akuntansi, Teknik, dll."
                    />
                  </div>
                  <div className="form-group">
                    <label>Tahun Lulus (Format: Tahun Masuk - Tahun Lulus)</label>
                    <input
                      type="text"
                      name="education_years"
                      value={formData.education_years}
                      onChange={handleInputChange}
                      placeholder="2020-2023"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nilai Akhir (IPK / Rata-rata UN)</label>
                    <input
                      type="text"
                      name="education_grade"
                      value={formData.education_grade}
                      onChange={handleInputChange}
                      placeholder="85.5 / 3.45"
                    />
                  </div>
                  <div className="form-group">
                    <label>Jumlah Tanggungan Keluarga</label>
                    <input
                      type="number"
                      name="dependents"
                      value={formData.dependents}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nama Ayah Kandung</label>
                    <input
                      type="text"
                      name="father_name"
                      value={formData.father_name}
                      onChange={handleInputChange}
                      placeholder="Nama ayah..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Nama Ibu Kandung</label>
                    <input
                      type="text"
                      name="mother_name"
                      value={formData.mother_name}
                      onChange={handleInputChange}
                      placeholder="Nama ibu..."
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Pekerjaan & Administrasi */}
              {modalTab === 'pekerjaan' && (
                <div className="form-grid">
                  <div className="form-group form-group-full">
                    <label>Pengalaman Kerja Sebelumnya (Nama Perusahaan - Posisi - Gaji - Alasan Keluar)</label>
                    <textarea
                      name="work_experience"
                      value={formData.work_experience}
                      onChange={handleInputChange}
                      placeholder="Contoh: PT Sumber Alfa - Kasir - 2024-2025 - Gaji Rp 3.000.000 - Kontrak Selesai"
                      rows={3}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nomor NPWP</label>
                    <input
                      type="text"
                      name="npwp"
                      value={formData.npwp}
                      onChange={handleInputChange}
                      placeholder="00.000.000.0-000.000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nomor Rekening Bank</label>
                    <input
                      type="text"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleInputChange}
                      placeholder="Nomor rekening pribadi..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Nama Bank & Kantor Cabang</label>
                    <input
                      type="text"
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleInputChange}
                      placeholder="BCA, Mandiri, BRI, dll."
                    />
                  </div>
                  <div className="form-group">
                    <label>Ukuran Seragam (Baju & Celana)</label>
                    <input
                      type="text"
                      name="uniform_size"
                      value={formData.uniform_size}
                      onChange={handleInputChange}
                      placeholder="Baju M / Celana 30"
                    />
                  </div>
                  <div className="form-group">
                    <label>BPJS Kesehatan (Nomor Kartu)</label>
                    <input
                      type="text"
                      name="bpjs_health"
                      value={formData.bpjs_health}
                      onChange={handleInputChange}
                      placeholder="000xxxxxxxx"
                    />
                  </div>
                  <div className="form-group">
                    <label>BPJS Ketenagakerjaan (Nomor Kartu)</label>
                    <input
                      type="text"
                      name="bpjs_employment"
                      value={formData.bpjs_employment}
                      onChange={handleInputChange}
                      placeholder="000xxxxxxxx"
                    />
                  </div>
                </div>
              )}

              {/* Tab 4: Kesehatan */}
              {modalTab === 'kesehatan' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tes Buta Warna (Hasil Pemeriksaan Dokter) *</label>
                    <select name="color_blind_test" value={formData.color_blind_test} onChange={handleInputChange}>
                      <option value="Normal">Normal (Bebas Buta Warna)</option>
                      <option value="Buta Warna Parsial">Buta Warna Parsial</option>
                      <option value="Buta Warna Sebagian">Buta Warna Sebagian</option>
                      <option value="Buta Warna Total">Buta Warna Total</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tinggi Badan (cm)</label>
                    <input
                      type="number"
                      name="height"
                      value={formData.height}
                      onChange={handleInputChange}
                      placeholder="165"
                    />
                  </div>
                  <div className="form-group">
                    <label>Berat Badan (kg)</label>
                    <input
                      type="number"
                      name="weight"
                      value={formData.weight}
                      onChange={handleInputChange}
                      placeholder="55"
                    />
                  </div>
                  <div className="form-group">
                    <label>Kondisi Fisik Umum</label>
                    <input
                      type="text"
                      name="physical_condition"
                      value={formData.physical_condition}
                      onChange={handleInputChange}
                      placeholder="Sehat, berkacamata, dll."
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label>Riwayat Penyakit Kronis (Diabetes, Jantung, Asma, dll.)</label>
                    <input
                      type="text"
                      name="health_history"
                      value={formData.health_history}
                      onChange={handleInputChange}
                      placeholder="Masukkan jika ada riwayat penyakit..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Alergi (Makanan / Obat)</label>
                    <input
                      type="text"
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleInputChange}
                      placeholder="Alergi udang, antibiotik, dll."
                    />
                  </div>
                  <div className="form-group">
                    <label>Obat yang Dikonsumsi Rutin</label>
                    <input
                      type="text"
                      name="medications"
                      value={formData.medications}
                      onChange={handleInputChange}
                      placeholder="Nama obat rutin..."
                    />
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setIsModalOpen(false); setEditingCandidateId(null); }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Menyimpan...' : editingCandidateId ? 'Simpan Perubahan' : 'Simpan Pelamar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default CandidateList;
