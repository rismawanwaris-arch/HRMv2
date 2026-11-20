import React, { useState, useRef } from 'react';
import { candidateApi } from '../services/api';

const EMPTY_FORM = {
  name: '',
  nik: '',
  phone: '',
  email: '',
  gender: 'Laki-laki',
  birth_place: '',
  birth_date: '',
  religion: 'Islam',
  marital_status: 'Belum Kawin',
  education_level: 'SMA / SMK',
  education_institution: '',
  education_major: '',
  address_ktp: '',
  address_domicile: '',
  work_experience: '',
};

const EMPTY_FILES = {
  cv: null,
  ktp: null,
  foto: null,
  ijazah: null,
  surat_lamaran: null,
  skck: null,
};

export default function UploadPelamar({ setView, onSelectCandidate }) {
  const [activeTab, setActiveTab] = useState('bulk'); // 'bulk' (default) | 'single'
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [files, setFiles] = useState(EMPTY_FILES);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Bulk Excel Upload State
  const [excelFile, setExcelFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelResult, setExcelResult] = useState(null);
  const [excelError, setExcelError] = useState(null);
  const excelInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (field, e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`Ukuran file ${file.name} melebihi batas 10 MB.`);
        e.target.value = '';
        return;
      }
      setFiles((prev) => ({ ...prev, [field]: file }));
    }
    e.target.value = '';
  };

  const handleRemoveFile = (field) => {
    setFiles((prev) => ({ ...prev, [field]: null }));
  };

  const handleDownloadTemplate = async () => {
    try {
      const resp = await candidateApi.downloadTemplate();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_import_pelamar.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Gagal mengunduh template Excel pelamar.');
    }
  };

  const handleDropExcel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (!dropped) return;
    const ext = dropped.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setExcelError('Format file harus .xlsx, .xls, atau .csv.');
      return;
    }
    setExcelError(null);
    setExcelFile(dropped);
  };

  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Nama lengkap pelamar wajib diisi.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSubmitResult(null);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          data.append(key, value);
        }
      });

      Object.entries(files).forEach(([field, file]) => {
        if (file) {
          data.append(field, file);
        }
      });

      const res = await candidateApi.uploadWithDocuments(data);
      if (res.success) {
        setSubmitResult(res);
        setFormData(EMPTY_FORM);
        setFiles(EMPTY_FILES);
      } else {
        setErrorMsg(res.message || 'Gagal mengunggah data pelamar.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengunggah berkas.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadExcel = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      setExcelError('Pilih file Excel terlebih dahulu.');
      return;
    }

    setUploadingExcel(true);
    setExcelError(null);
    setExcelResult(null);

    try {
      const data = new FormData();
      data.append('file', excelFile);

      const res = await candidateApi.importExcel(data);
      if (res.success) {
        setExcelResult(res);
        setExcelFile(null);
        if (excelInputRef.current) excelInputRef.current.value = '';
      } else {
        setExcelError(res.message || 'Gagal memproses file Excel.');
      }
    } catch (err) {
      setExcelError(err.message || 'Terjadi kesalahan saat mengunggah file.');
    } finally {
      setUploadingExcel(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fieldInputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    outline: 'none'
  };

  const fieldLabelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px'
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Pelamar & Import Google Form</h1>
          <p className="page-subtitle">
            Import respon Google Form pelamar via Excel (<code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>.xlsx</code> / <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>.csv</code>) atau daftarkan pelamar manual dan simpan berkas ke penyimpanan server.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setView('candidates')}
          >
            👥 Lihat Daftar Pelamar ➔
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        background: 'var(--bg-secondary)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('bulk')}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'bulk' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'bulk' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          📊 Import Excel Respon Google Form (.xlsx / .csv)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'single' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'single' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          📝 Input Pelamar Manual & Upload Berkas
        </button>
      </div>

      {/* TAB 1: IMPORT MASSAL EXCEL DARI GOOGLE FORM */}
      {activeTab === 'bulk' && (
        <div className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Import Respon Google Form ke Database Pelamar
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
              Bagikan link Google Form ke calon karyawan. Setelah terisi, unduh spreadsheet respon dari Google Sheets/Excel lalu upload file (<code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>.xlsx</code> / <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>.csv</code>) di sini. Sistem akan otomatis memasukkan semua pelamar dan men-generate kode unik akses ujian online.
            </p>

            {/* Workflow Info Box */}
            <div style={{
              background: 'var(--color-info-bg)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-info)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💡</span> Alur Kerja Rekrutmen Google Form:
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <li>Kirim link Google Form ke calon karyawan untuk mengisi biodata.</li>
                <li>Di Google Form, buka tab <strong>"Responses"</strong> ➔ Klik <strong>"Download responses (.csv)"</strong> atau <strong>"Open in Sheets" ➔ File ➔ Download ➔ Microsoft Excel (.xlsx)</strong>.</li>
                <li>Unggah file tersebut pada formulir di bawah. Nama kolom Google Form akan otomatis dicocokkan dengan database sistem HRM.</li>
                <li>Pelamar langsung terdaftar di sistem dengan kode akses ujian tertulis masing-masing!</li>
              </ol>
            </div>

            {/* Template Download Card */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              textAlign: 'left'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Template Excel / Format Kolom Google Form
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Unduh template contoh untuk panduan membuat pertanyaan di Google Form atau import langsung.
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-info-bg)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: 'var(--color-info)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📥 Unduh Template (.xlsx)
              </button>
            </div>

            {/* Error Message */}
            {excelError && (
              <div style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '20px',
                color: 'var(--color-danger)',
                fontSize: '13px',
                textAlign: 'left'
              }}>
                ⚠️ {excelError}
              </div>
            )}

            {/* Success Result */}
            {excelResult && (
              <div style={{
                background: 'var(--color-success-bg)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-success)', marginBottom: '8px' }}>
                  🎉 {excelResult.message}
                </div>
                {excelResult.stats && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Total Baris: <strong>{excelResult.stats.total_rows}</strong> • Berhasil: <strong>{excelResult.stats.success_count}</strong> • Dilewati: <strong>{excelResult.stats.skipped_count}</strong>
                  </div>
                )}
                {excelResult.stats?.errors?.length > 0 && (
                  <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--color-danger-bg)', borderRadius: '8px', fontSize: '11px', color: 'var(--color-danger)' }}>
                    <strong>Catatan Baris Dilewati:</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                      {excelResult.stats.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {excelResult.candidates && excelResult.candidates.length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>KANDIDAT BARU DITAMBAHKAN:</div>
                    {excelResult.candidates.map(c => (
                      <div key={c.id} style={{ fontSize: '12px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span>{c.name}</span>
                        <code style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{c.access_code}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dropzone & Upload Button */}
            <form onSubmit={handleUploadExcel}>
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDrop={handleDropExcel}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: '14px',
                  padding: '30px 20px',
                  marginBottom: '20px',
                  background: dragActive ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
              >
                <input
                  ref={excelInputRef}
                  type="file"
                  id="excel_input"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    setExcelFile(e.target.files ? e.target.files[0] : null);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                <label htmlFor="excel_input" style={{ cursor: 'pointer', display: 'block' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>📁</div>
                  {excelFile ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success)' }}>{excelFile.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatBytes(excelFile.size)} • Klik untuk ganti file</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Pilih File Excel / CSV Google Form</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Seret file ke sini atau klik untuk browse file dari komputer</div>
                    </div>
                  )}
                </label>
              </div>

              <button
                type="submit"
                disabled={!excelFile || uploadingExcel}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  justifyContent: 'center',
                  fontSize: '14px',
                  opacity: !excelFile || uploadingExcel ? 0.6 : 1,
                  cursor: !excelFile || uploadingExcel ? 'not-allowed' : 'pointer'
                }}
              >
                {uploadingExcel ? '⏳ Sedang Mengimpor Data...' : '📤 Mulai Import Data Pelamar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: FORM INPUT PELAMAR MANUAL + UPLOAD BERKAS */}
      {activeTab === 'single' && (
        <div>
          {/* Success Banner */}
          {submitResult && (
            <div style={{
              background: 'var(--color-success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '18px 24px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-success)', marginBottom: '4px' }}>
                    ✅ {submitResult.message}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Pelamar ID: <strong>#{submitResult.candidateId}</strong> • Kode Akses Ujian Online: <code style={{ fontSize: '14px', fontWeight: 700, background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: '4px', color: 'var(--color-warning)', border: '1px solid var(--border-color)' }}>{submitResult.accessCode}</code>
                  </div>
                  {submitResult.uploadedDocuments && submitResult.uploadedDocuments.length > 0 && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Berkas tersimpan di penyimpanan: {submitResult.uploadedDocuments.map(d => `${d.doc_type} (${d.original_name})`).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectCandidate) {
                        onSelectCandidate(submitResult.candidateId);
                        setView('detail');
                      } else {
                        setView('candidates');
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-success)',
                      color: 'white',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Buka Profil Pelamar ➔
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitResult(null)}
                    style={{
                      padding: '8px 14px',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '20px',
              color: 'var(--color-danger)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* FORMULIR LENGKAP PELAMAR */}
          <form onSubmit={handleSubmitSingle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '24px', marginBottom: '24px' }}>

              {/* KOLOM KIRI: BIODATA & PENDIDIKAN */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>👤</span> 1. Biodata & Informasi Pribadi
                </h3>

                <div>
                  <label style={fieldLabelStyle}>
                    Nama Lengkap Pelamar *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Contoh: Ahmad Rizki Pratama"
                    required
                    style={fieldInputStyle}
                  />
                </div>

                <div className="responsive-grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>
                      Nomor Induk Kependudukan (NIK)
                    </label>
                    <input
                      type="text"
                      name="nik"
                      value={formData.nik}
                      onChange={handleInputChange}
                      placeholder="16 digit NIK"
                      maxLength={20}
                      style={fieldInputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>
                      Jenis Kelamin
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      style={fieldInputStyle}
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                </div>

                <div className="responsive-grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>
                      No. WhatsApp / HP *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="081234567890"
                      style={fieldInputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>
                      Alamat Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="pelamar@email.com"
                      style={fieldInputStyle}
                    />
                  </div>
                </div>

                <div className="responsive-grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      name="birth_place"
                      value={formData.birth_place}
                      onChange={handleInputChange}
                      placeholder="Bandung"
                      style={fieldInputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>
                      Tanggal Lahir
                    </label>
                    <input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleInputChange}
                      style={fieldInputStyle}
                    />
                  </div>
                </div>

                <div className="responsive-grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>Agama</label>
                    <select
                      name="religion"
                      value={formData.religion}
                      onChange={handleInputChange}
                      style={fieldInputStyle}
                    >
                      {['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Status Perkawinan</label>
                    <select
                      name="marital_status"
                      value={formData.marital_status}
                      onChange={handleInputChange}
                      style={fieldInputStyle}
                    >
                      <option value="Belum Kawin">Belum Kawin</option>
                      <option value="Kawin">Kawin</option>
                      <option value="Cerai Hidup">Cerai Hidup</option>
                      <option value="Cerai Mati">Cerai Mati</option>
                    </select>
                  </div>
                </div>

                <div className="responsive-grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label style={fieldLabelStyle}>
                      Pendidikan Terakhir
                    </label>
                    <select
                      name="education_level"
                      value={formData.education_level}
                      onChange={handleInputChange}
                      style={fieldInputStyle}
                    >
                      <option value="SMA / SMK">SMA / SMK</option>
                      <option value="D3">D3</option>
                      <option value="D4 / S1">D4 / S1</option>
                      <option value="S2">S2</option>
                      <option value="SMP">SMP</option>
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>
                      Asal Sekolah / Kampus
                    </label>
                    <input
                      type="text"
                      name="education_institution"
                      value={formData.education_institution}
                      onChange={handleInputChange}
                      placeholder="SMK Negeri 1"
                      style={fieldInputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={fieldLabelStyle}>
                    Jurusan Pendidikan
                  </label>
                  <input
                    type="text"
                    name="education_major"
                    value={formData.education_major}
                    onChange={handleInputChange}
                    placeholder="Contoh: Akuntansi / TKJ / Manajemen"
                    style={fieldInputStyle}
                  />
                </div>

                <div>
                  <label style={fieldLabelStyle}>
                    Alamat KTP
                  </label>
                  <textarea
                    name="address_ktp"
                    rows={2}
                    value={formData.address_ktp}
                    onChange={handleInputChange}
                    placeholder="Alamat sesuai KTP pelamar..."
                    style={{ ...fieldInputStyle, resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={fieldLabelStyle}>
                    Alamat Domisili Sekarang
                  </label>
                  <textarea
                    name="address_domicile"
                    rows={2}
                    value={formData.address_domicile}
                    onChange={handleInputChange}
                    placeholder="Alamat tempat tinggal pelamar..."
                    style={{ ...fieldInputStyle, resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={fieldLabelStyle}>
                    Ringkasan Pengalaman Kerja
                  </label>
                  <textarea
                    name="work_experience"
                    rows={2}
                    value={formData.work_experience}
                    onChange={handleInputChange}
                    placeholder="Contoh: Kasir di Indomaret (1 tahun), Sales Counter (6 bulan)"
                    style={{ ...fieldInputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* KOLOM KANAN: BERKAS FISIK DOKUMEN SERVER */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📂</span> 2. Berkas Dokumen Fisik (Penyimpanan Server)
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  File yang terlampir akan disimpan permanen ke server (maks 10 MB per berkas).
                </p>

                {/* 1. CV / Resume */}
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: files.cv ? '1px solid var(--color-success)' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      📄 1. CV / Curriculum Vitae
                    </span>
                    {files.cv && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatBytes(files.cv.size)}
                      </span>
                    )}
                  </div>
                  {files.cv ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.cv.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('cv')} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('cv', e)}
                      style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                    />
                  )}
                </div>

                {/* 2. KTP / Identitas */}
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: files.ktp ? '1px solid var(--color-success)' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🪪 2. Foto / Scan KTP
                    </span>
                    {files.ktp && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatBytes(files.ktp.size)}
                      </span>
                    )}
                  </div>
                  {files.ktp ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.ktp.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('ktp')} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('ktp', e)}
                      style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                    />
                  )}
                </div>

                {/* 3. Pas Foto */}
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: files.foto ? '1px solid var(--color-success)' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🖼️ 3. Pas Foto Pelamar
                    </span>
                    {files.foto && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatBytes(files.foto.size)}
                      </span>
                    )}
                  </div>
                  {files.foto ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.foto.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('foto')} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('foto', e)}
                      style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                    />
                  )}
                </div>

                {/* 4. Ijazah / Transkrip */}
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: files.ijazah ? '1px solid var(--color-success)' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🎓 4. Scan Ijazah / Transkrip Nilai
                    </span>
                    {files.ijazah && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatBytes(files.ijazah.size)}
                      </span>
                    )}
                  </div>
                  {files.ijazah ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.ijazah.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('ijazah')} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('ijazah', e)}
                      style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                    />
                  )}
                </div>

                {/* 5. Surat Lamaran / SKCK */}
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: files.surat_lamaran || files.skck ? '1px solid var(--color-success)' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      📑 5. Surat Lamaran & SKCK (Opsional)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>File Surat Lamaran (.pdf/.doc/.docx/.jpg)</div>
                      {files.surat_lamaran ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-success-bg)', padding: '6px 12px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>Surat Lamaran: {files.surat_lamaran.name}</span>
                          <button type="button" onClick={() => handleRemoveFile('surat_lamaran')} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange('surat_lamaran', e)}
                          style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                        />
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>File SKCK (.pdf/.jpg/.jpeg/.png)</div>
                      {files.skck ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-success-bg)', padding: '6px 12px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>SKCK: {files.skck.name}</span>
                          <button type="button" onClick={() => handleRemoveFile('skck')} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange('skck', e)}
                          style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{
                    marginTop: '8px',
                    padding: '14px 20px',
                    justifyContent: 'center',
                    fontSize: '14px',
                    opacity: submitting ? 0.65 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? '💾 Sedang Menyimpan Data...' : '🚀 Simpan Pelamar & Berkas'}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}
    </div>
  );
}
