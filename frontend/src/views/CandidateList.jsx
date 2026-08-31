import React, { useState, useEffect } from 'react';
import API_BASE from '../config';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function CandidateList({ onSelectCandidate }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('pribadi'); // 'pribadi', 'pendidikan', 'pekerjaan', 'kesehatan'
  const [editingCandidateId, setEditingCandidateId] = useState(null);

  // New Candidate Form State (from MD Section 5)
  const [formData, setFormData] = useState({
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
  });

  const [stages, setStages] = useState([]);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const res = await fetch(`${API_BASE}/stages`);
      const data = await res.json();
      if (data.success) {
        setStages(data.data.filter(s => s.is_active === 1));
      }
    } catch (err) {
      console.error('Error fetching stages:', err);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [search, statusFilter, stageFilter]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (stageFilter) queryParams.append('stage', stageFilter);

      const res = await fetch(`${API_BASE}/candidates?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCandidates(data.data);
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
      setError('Gagal memuat daftar pelamar.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenEditModal = (candidate, e) => {
    if (e) e.stopPropagation();
    setEditingCandidateId(candidate.id);
    setFormData({
      name: candidate.name || '',
      nik: candidate.nik || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      gender: candidate.gender || 'Laki-laki',
      birth_place: candidate.birth_place || '',
      birth_date: candidate.birth_date || '',
      religion: candidate.religion || '',
      marital_status: candidate.marital_status || 'Belum Kawin',
      dependents: candidate.dependents || 0,
      blood_type: candidate.blood_type || '',
      height: candidate.height || '',
      weight: candidate.weight || '',
      physical_condition: candidate.physical_condition || 'Sehat',
      address_ktp: candidate.address_ktp || '',
      address_domicile: candidate.address_domicile || '',
      emergency_contact_1: candidate.emergency_contact_1 || '',
      emergency_contact_2: candidate.emergency_contact_2 || '',
      father_name: candidate.father_name || '',
      mother_name: candidate.mother_name || '',
      spouse_name: candidate.spouse_name || '',
      children_data: candidate.children_data || '',
      education_level: candidate.education_level || 'SMA / SMK',
      education_institution: candidate.education_institution || '',
      education_major: candidate.education_major || '',
      education_years: candidate.education_years || '',
      education_grade: candidate.education_grade || '',
      work_experience: candidate.work_experience || '',
      npwp: candidate.npwp || '',
      bank_account: candidate.bank_account || '',
      bank_name: candidate.bank_name || '',
      bpjs_health: candidate.bpjs_health || '',
      bpjs_employment: candidate.bpjs_employment || '',
      bpjs_active: candidate.bpjs_active || 'Tidak Aktif',
      uniform_size: candidate.uniform_size || '',
      health_history: candidate.health_history || '',
      allergies: candidate.allergies || '',
      medications: candidate.medications || '',
      color_blind_test: candidate.color_blind_test || 'Normal',
      status: candidate.status || 'Active',
      current_stage: candidate.current_stage || 1
    });
    setModalTab('pribadi');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Nama lengkap wajib diisi!');
      return;
    }

    try {
      const url = editingCandidateId 
        ? `${API_BASE}/candidates/${editingCandidateId}`
        : `${API_BASE}/candidates`;
      
      const method = editingCandidateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        if (editingCandidateId) {
          alert('Profil pelamar berhasil diperbarui!');
        } else {
          alert(`Kandidat berhasil ditambahkan!\nKode Akses Ujian: ${data.accessCode}`);
        }
        setIsModalOpen(false);
        setEditingCandidateId(null);
        // Reset form
        setFormData({
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
        });
        setModalTab('pribadi');
        fetchCandidates();
      } else {
        alert(data.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Terjadi kesalahan koneksi ke server.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingCandidateId(null);
    setFormData({
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
    });
    setModalTab('pribadi');
    setIsModalOpen(true);
  };

  const handleDeleteCandidate = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kandidat "${name}"? Semua data tahapan evaluasi akan ikut terhapus.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/candidates/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchCandidates();
      } else {
        alert(data.message || 'Gagal menghapus kandidat.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const exportCandidateToPDF = async (candidate, e) => {
    e.stopPropagation();
    const doc = new jsPDF();
    
    // Load Logo
    const img = new Image();
    img.src = '/logo.png';
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      // (image, format, x, y, width, height)
      doc.addImage(img, 'PNG', 14, 12, 16, 20);
    } catch (err) {
      console.warn("Logo tidak dapat dimuat.");
    }

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CV. ASYA BISNIS INDONESIA', 34, 14);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('RETAIL & JASA LAYANAN ISI ULANG PRABAYAR', 34, 19);
    doc.text('Jl. Buni Sari No.238, Antapani Wetan, Kec. Antapani, Kota Bandung, Jawa Barat 40291', 34, 23);
    doc.text('+62 878-8786-5166', 34, 27);

    // Double line separator
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);
    doc.setLineWidth(0.2);
    doc.line(14, 33, 196, 33);

    const cell = (content, colSpan = 1, styles = {}) => ({ content, colSpan, styles });
    const cWidths = { 0: { cellWidth: 35 }, 1: { cellWidth: 30 }, 2: { cellWidth: 26 }, 3: { cellWidth: 30 }, 4: { cellWidth: 26 }, 5: { cellWidth: 35 } };

    // TITLE TABLE
    autoTable(doc, {
      startY: 40,
      theme: 'grid',
      head: [[cell('FORMULIR DATA PELAMAR', 6, { halign: 'center', fontSize: 14, fillColor: [253, 203, 158], textColor: 0, fontStyle: 'bold' })]],
      body: [
        [cell('1. ISI DENGAN BENAR, KETIK DENGAN LENGKAP DAN JELAS.', 4), cell(`Tanggal : ${new Date().toLocaleDateString('id-ID')}`, 2)],
        [cell('2. JANGAN MENAMBAH ATAU MERUBAH BENTUK DAN ISI FORMULIR INI.', 6)]
      ],
      styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
      headStyles: { lineWidth: 0.2, lineColor: 0 },
      columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 25 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 }, 5: { cellWidth: 32 } }
    });

    // A. BIODATA
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      theme: 'grid',
      head: [[cell('A. BIODATA CALON KARYAWAN', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
      body: [
        [cell('1. Nama Lengkap :', 1), cell(candidate.name || '-', 5)],
        [
          cell('2. Jenis Kelamin :', 1), cell(candidate.gender || '-', 1),
          cell('3. Tinggi Badan :', 1), cell(candidate.height ? `${candidate.height} cm` : '-', 1),
          cell('4. Berat Badan :', 1), cell(candidate.weight ? `${candidate.weight} kg` : '-', 1)
        ],
        [cell('5. Tempat & Tgl. Lahir :', 1), cell(`${candidate.birth_place || '-'}, ${candidate.birth_date ? new Date(candidate.birth_date).toLocaleDateString('id-ID') : '-'}`, 5)],
        [cell('6. Alamat Domisili :', 1), cell(candidate.address_domicile || '-', 5)],
        [cell('7. Alamat KTP :', 1), cell(candidate.address_ktp || '-', 5)],
        [cell('8. No. Telephone :', 1), cell(candidate.phone || '-', 2), cell('No. Handphone :', 1), cell(candidate.phone || '-', 2)],
        [cell('9. E-mail :', 1), cell(candidate.email || '-', 5)],
        [
          cell('10. Agama :', 1), cell(candidate.religion || '-', 2),
          cell('11. Gol. Darah :', 1), cell(candidate.blood_type || '-', 2)
        ],
        [
          cell('12. Status Perkawinan :', 1), cell(candidate.marital_status || '-', 2),
          cell('13. Tanggungan :', 1), cell(candidate.dependents?.toString() || '0', 2)
        ]
      ],
      styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
      headStyles: { lineWidth: 0.2, lineColor: 0 },
      columnStyles: cWidths
    });

    // B. DATA KELUARGA & KONTAK
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      theme: 'grid',
      head: [[cell('B. DATA KELUARGA & KONTAK DARURAT', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
      body: [
        [cell('Nama Ayah :', 1), cell(candidate.father_name || '-', 5)],
        [cell('Nama Ibu :', 1), cell(candidate.mother_name || '-', 5)],
        [cell('Nama Pasangan :', 1), cell(candidate.spouse_name || '-', 5)],
        [cell('Kontak Darurat 1 :', 1), cell(candidate.emergency_contact_1 || '-', 5)],
        [cell('Kontak Darurat 2 :', 1), cell(candidate.emergency_contact_2 || '-', 5)],
      ],
      styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
      headStyles: { lineWidth: 0.2, lineColor: 0 },
      columnStyles: cWidths
    });

    // C. PENDIDIKAN & PEKERJAAN
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      theme: 'grid',
      head: [[cell('C. PENDIDIKAN & PEKERJAAN', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
      body: [
        [cell('Pendidikan Terakhir :', 1), cell(candidate.education_level || '-', 2), cell('Institusi :', 1), cell(candidate.education_institution || '-', 2)],
        [cell('Jurusan :', 1), cell(candidate.education_major || '-', 2), cell('Tahun Lulus :', 1), cell(candidate.education_years || '-', 2)],
        [cell('Nilai / IPK :', 1), cell(candidate.education_grade || '-', 5)],
        [cell('Pengalaman Kerja :', 1), cell(candidate.work_experience || '-', 5)]
      ],
      styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
      headStyles: { lineWidth: 0.2, lineColor: 0 },
      columnStyles: cWidths
    });

    // D. KESEHATAN & ADMINISTRASI
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      theme: 'grid',
      head: [[cell('D. KESEHATAN & ADMINISTRASI', 6, { fillColor: [253, 203, 158], textColor: 0 })]],
      body: [
        [cell('Kondisi Fisik :', 1), cell(candidate.physical_condition || '-', 2), cell('Tes Buta Warna :', 1), cell(candidate.color_blind_test || '-', 2)],
        [cell('Riwayat Penyakit :', 1), cell(candidate.health_history || '-', 2), cell('Alergi :', 1), cell(candidate.allergies || '-', 2)],
        [cell('Obat Rutin :', 1), cell(candidate.medications || '-', 5)],
        [
          cell('NPWP :', 1), cell(candidate.npwp || '-', 2),
          cell('Ukuran Seragam :', 1), cell(candidate.uniform_size || '-', 2)
        ],
        [
          cell('Nama Bank :', 1), cell(candidate.bank_name || '-', 2),
          cell('No. Rekening :', 1), cell(candidate.bank_account || '-', 2)
        ],
        [
          cell('BPJS Kesehatan :', 1), cell(candidate.bpjs_health || '-', 2),
          cell('BPJS Naker :', 1), cell(candidate.bpjs_employment || '-', 2)
        ],
      ],
      styles: { fontSize: 9, textColor: 0, lineColor: 0, lineWidth: 0.2 },
      headStyles: { lineWidth: 0.2, lineColor: 0 },
      columnStyles: cWidths
    });

    doc.save(`Data_Pelamar_${candidate.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Kelola Pelamar Kerja</h1>
          <p className="page-subtitle">Pencarian, filter, dan penambahan kandidat frontliner.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tambah Pelamar Baru
        </button>
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
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Tidak ada pelamar yang cocok dengan kriteria pencarian.</div>
        ) : (
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
                        const stageName = stageConfig ? stageConfig.name : 'Unknown';
                        return `${stageIndex}. ${stageName}`;
                      })()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status.toLowerCase()}`}>
                      {c.status === 'Active' ? 'Seleksi' : c.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {new Date(c.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                        onClick={(e) => exportCandidateToPDF(c, e)}
                        title="Download PDF"
                      >
                        PDF
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => onSelectCandidate(c.id)}
                      >
                        Detail Evaluasi
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                        onClick={(e) => handleOpenEditModal(c, e)}
                      >
                        Edit Profil
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
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
        )}
      </div>

      {/* Add Candidate Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingCandidateId ? 'Edit Profil Pelamar Kerja' : 'Form Data Diri Pelamar Baru'}</h2>
              <button className="close-btn" onClick={() => { setIsModalOpen(false); setEditingCandidateId(null); }}>×</button>
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
                      <option value="Belum Kawin">Belum Kawin</option>
                      <option value="Kawin">Kawin</option>
                      <option value="Cerai Hidup">Cerai Hidup</option>
                      <option value="Cerai Mati">Cerai Mati</option>
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
                      <option value="SMA / SMK">SMA / SMK Sederajat</option>
                      <option value="D3">Diploma 3 (D3)</option>
                      <option value="S1 / D4">Sarjana / D4</option>
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
                >
                  {editingCandidateId ? 'Simpan Perubahan' : 'Simpan Pelamar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateList;
