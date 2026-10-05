import React, { useState } from 'react';
import { candidateApi } from '../services/api';

export default function UploadPelamar({ setView, onSelectCandidate }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'bulk'

  // Single Candidate Form Data
  const [formData, setFormData] = useState({
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
  });

  // Uploaded Files State
  const [files, setFiles] = useState({
    cv: null,
    ktp: null,
    foto: null,
    ijazah: null,
    surat_lamaran: null,
    skck: null,
  });

  // AI CV Scanner State (Google Gemini)
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Bulk Excel Upload State
  const [excelFile, setExcelFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelResult, setExcelResult] = useState(null);
  const [excelError, setExcelError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (field, e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`Ukuran file ${file.name} melebihi batas 10 MB.`);
        return;
      }
      setFiles((prev) => ({ ...prev, [field]: file }));
    }
  };

  const handleRemoveFile = (field) => {
    setFiles((prev) => ({ ...prev, [field]: null }));
  };

  // AI CV Scan & Auto-Fill Handler
  const handleScanCvWithAI = async (file) => {
    if (!file) return;

    // Attach as CV document
    setFiles((prev) => ({ ...prev, cv: file }));

    setAiScanning(true);
    setAiError(null);
    setAiSuccessMsg(null);
    setAiResult(null);

    try {
      const data = new FormData();
      data.append('cv', file);

      const res = await candidateApi.parseCv(data);
      if (res.success && res.data) {
        const parsed = res.data;

        // Auto-fill form fields with parsed data
        setFormData((prev) => ({
          ...prev,
          name: parsed.name || prev.name,
          nik: parsed.nik || prev.nik,
          phone: parsed.phone || prev.phone,
          email: parsed.email || prev.email,
          gender: parsed.gender || prev.gender,
          birth_place: parsed.birth_place || prev.birth_place,
          birth_date: parsed.birth_date || prev.birth_date,
          religion: parsed.religion || prev.religion,
          marital_status: parsed.marital_status || prev.marital_status,
          education_level: parsed.education_level || prev.education_level,
          education_institution: parsed.education_institution || prev.education_institution,
          education_major: parsed.education_major || prev.education_major,
          address_ktp: parsed.address_ktp || prev.address_ktp,
          address_domicile: parsed.address_domicile || prev.address_domicile,
          work_experience: parsed.work_experience || prev.work_experience,
        }));

        if (parsed.assessment) {
          setAiResult(parsed.assessment);
        }

        setAiSuccessMsg('✨ CV berhasil dianalisis oleh Google Gemini AI! Kolom formulir telah terisi otomatis.');
      } else {
        setAiError(res.message || 'Gagal membaca isi CV dengan AI.');
      }
    } catch (err) {
      setAiError(err.message || 'Terjadi kesalahan saat memproses CV dengan AI Gemini.');
    } finally {
      setAiScanning(false);
    }
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

      // Append uploaded documents
      Object.entries(files).forEach(([field, file]) => {
        if (file) {
          data.append(field, file);
        }
      });

      // Append AI Assessment if available
      if (aiResult) {
        data.append('ai_assessment', JSON.stringify(aiResult));
      }

      const res = await candidateApi.uploadWithDocuments(data);
      if (res.success) {
        setSubmitResult(res);
        // Reset form
        setFormData({
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
        });
        setFiles({
          cv: null,
          ktp: null,
          foto: null,
          ijazah: null,
          surat_lamaran: null,
          skck: null,
        });
        setAiResult(null);
        setAiSuccessMsg(null);
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

  return (
    <div className="view-container">
      {/* Page Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📤 Upload Pelamar Baru & AI CV Parser</span>
          </h1>
          <p className="view-subtitle">
            Scan & ekstrak CV otomatis dengan Google Gemini AI, evaluasi standar HRD, dan simpan dokumen ke penyimpanan ZimaOS (<code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>/app/data/uploads</code>).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setView('candidates')}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            👥 Lihat Daftar Pelamar ➔
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        background: 'var(--bg-secondary)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          style={{
            flex: 1,
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
          🤖 Auto-Fill CV (AI Gemini) & Upload Berkas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bulk')}
          style={{
            flex: 1,
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
          📊 Import Massal Spreadsheet Excel (.xlsx / .csv)
        </button>
      </div>

      {/* TAB 1: FORM PELAMAR + AI CV SCANNER */}
      {activeTab === 'single' && (
        <div>
          {/* AI SCANNER DROPZONE HERO */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(59, 130, 246, 0.08))',
            border: '2px dashed rgba(139, 92, 246, 0.4)',
            borderRadius: '14px',
            padding: '24px',
            marginBottom: '24px',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '24px' }}>✨</span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#a78bfa' }}>
                Auto-Fill Data Pelamar & Screening dengan Google Gemini AI
              </h3>
            </div>
            <p style={{ margin: '0 auto 16px', maxWidth: '640px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Unggah file CV pelamar (<strong>PDF</strong>, <strong>DOCX</strong>, atau <strong>Foto/Scan HP</strong>). AI akan otomatis membaca biodata, mengisi formulir di bawah, dan menilai kesesuaian profil dengan standar HRD.
            </p>

            <input
              type="file"
              id="ai_cv_input"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleScanCvWithAI(e.target.files[0]);
                }
              }}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label
                htmlFor="ai_cv_input"
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: aiScanning ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                  opacity: aiScanning ? 0.7 : 1
                }}
              >
                {aiScanning ? '🤖 AI Sedang Membaca & Menilai CV...' : '⚡ Pilih File CV untuk Auto-Fill (PDF / Gambar)'}
              </label>
            </div>

            {aiScanning && (
              <div style={{ marginTop: '16px', fontSize: '13px', color: '#a78bfa', fontWeight: 600 }}>
                ⏳ Sedang mengekstrak teks, membaca foto/scan, dan menghitung skor standar HRD...
              </div>
            )}

            {aiError && (
              <div style={{
                marginTop: '16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#ef4444',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                ⚠️ {aiError}
              </div>
            )}

            {aiSuccessMsg && (
              <div style={{
                marginTop: '16px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#10b981',
                fontSize: '13px',
                fontWeight: 600
              }}>
                {aiSuccessMsg}
              </div>
            )}
          </div>

          {/* AI HRD ASSESSMENT RESULT CARD (JIKA SUDAH DI-SCAN) */}
          {aiResult && (
            <div style={{
              background: 'var(--bg-card, #1e1e2d)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>🎯</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Hasil Penilaian & Standar HRD (Google Gemini AI)
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                      Evaluasi kesesuaian profil untuk posisi Retail Frontliner / Kasir / Staff
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Match Score</div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 900,
                      color: aiResult.match_score >= 80 ? '#10b981' : aiResult.match_score >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                      {aiResult.match_score}%
                    </div>
                  </div>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    background: aiResult.match_score >= 80 ? 'rgba(16,185,129,0.2)' : aiResult.match_score >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                    color: aiResult.match_score >= 80 ? '#10b981' : aiResult.match_score >= 60 ? '#f59e0b' : '#ef4444',
                    border: `1px solid ${aiResult.match_score >= 80 ? 'rgba(16,185,129,0.4)' : aiResult.match_score >= 60 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`
                  }}>
                    {aiResult.recommendation || (aiResult.match_score >= 80 ? 'Sangat Direkomendasikan' : aiResult.match_score >= 60 ? 'Dipertimbangkan' : 'Kurang Sesuai')}
                  </span>
                </div>
              </div>

              {/* Criteria Checks Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{aiResult.usia_sesuai ? '✅' : '⚠️'}</span>
                  <span style={{ fontSize: '12px', color: aiResult.usia_sesuai ? 'var(--text-primary)' : '#f59e0b', fontWeight: 600 }}>
                    Usia (18-25 Thn)
                  </span>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{aiResult.pendidikan_sesuai ? '✅' : '⚠️'}</span>
                  <span style={{ fontSize: '12px', color: aiResult.pendidikan_sesuai ? 'var(--text-primary)' : '#f59e0b', fontWeight: 600 }}>
                    Min. SMA / SMK
                  </span>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{aiResult.domisili_sesuai ? '✅' : '⚠️'}</span>
                  <span style={{ fontSize: '12px', color: aiResult.domisili_sesuai ? 'var(--text-primary)' : '#f59e0b', fontWeight: 600 }}>
                    Domisili Sesuai
                  </span>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{aiResult.pengalaman_relevan ? '✅' : 'ℹ️'}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    Pengalaman & Skill
                  </span>
                </div>
              </div>

              {/* Summary */}
              {aiResult.summary && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', borderLeft: '3px solid #3b82f6', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Ringkasan Profil:</strong> {aiResult.summary}
                </div>
              )}

              {/* Strengths & Interview Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {aiResult.strengths && aiResult.strengths.length > 0 && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#10b981', marginBottom: '6px', textTransform: 'uppercase' }}>
                      🌟 Kelebihan Utama (Strengths)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {aiResult.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.interview_notes && aiResult.interview_notes.length > 0 && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase' }}>
                      🔍 Catatan Konfirmasi Wawancara
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {aiResult.interview_notes.map((n, idx) => (
                        <li key={idx}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {submitResult && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '18px 24px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
                    ✅ {submitResult.message}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Pelamar ID: <strong>#{submitResult.candidateId}</strong> • Kode Akses Ujian Online: <code style={{ fontSize: '14px', fontWeight: 700, background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px', color: '#f59e0b' }}>{submitResult.accessCode}</code>
                  </div>
                  {submitResult.uploadedDocuments && submitResult.uploadedDocuments.length > 0 && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Berkas tersimpan di ZimaOS: {submitResult.uploadedDocuments.map(d => `${d.doc_type} (${d.original_name})`).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
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
                      background: '#10b981',
                      color: '#000',
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
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '20px',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 600
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* FORMULIR LENGKAP PELAMAR */}
          <form onSubmit={handleSubmitSingle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              
              {/* KOLOM KIRI: BIODATA & PENDIDIKAN */}
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>👤</span> 1. Biodata & Informasi Pribadi
                </h3>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Nama Lengkap Pelamar *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Contoh: Ahmad Rizki Pratama"
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Nomor Induk Kependudukan (NIK)
                    </label>
                    <input
                      type="text"
                      name="nik"
                      value={formData.nik}
                      onChange={handleInputChange}
                      placeholder="16 digit NIK"
                      maxLength={20}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Jenis Kelamin
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      No. WhatsApp / HP *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="081234567890"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Alamat Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="pelamar@email.com"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Tempat Lahir
                    </label>
                    <input
                      type="text"
                      name="birth_place"
                      value={formData.birth_place}
                      onChange={handleInputChange}
                      placeholder="Bandung"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Tanggal Lahir
                    </label>
                    <input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleInputChange}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Pendidikan Terakhir
                    </label>
                    <select
                      name="education_level"
                      value={formData.education_level}
                      onChange={handleInputChange}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="SMA / SMK">SMA / SMK</option>
                      <option value="D3">D3</option>
                      <option value="D4 / S1">D4 / S1</option>
                      <option value="S2">S2</option>
                      <option value="SMP">SMP</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Asal Sekolah / Kampus
                    </label>
                    <input
                      type="text"
                      name="education_institution"
                      value={formData.education_institution}
                      onChange={handleInputChange}
                      placeholder="SMK Negeri 1"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Jurusan Pendidikan
                  </label>
                  <input
                    type="text"
                    name="education_major"
                    value={formData.education_major}
                    onChange={handleInputChange}
                    placeholder="Contoh: Akuntansi / TKJ / Manajemen"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Alamat Domisili Sekarang
                  </label>
                  <textarea
                    name="address_domicile"
                    rows={2}
                    value={formData.address_domicile}
                    onChange={handleInputChange}
                    placeholder="Alamat tempat tinggal pelamar..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Ringkasan Pengalaman Kerja
                  </label>
                  <textarea
                    name="work_experience"
                    rows={2}
                    value={formData.work_experience}
                    onChange={handleInputChange}
                    placeholder="Contoh: Kasir di Indomaret (1 tahun), Sales Counter (6 bulan)"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* KOLOM KANAN: BERKAS FISIK DOKUMEN ZIMAOS */}
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📂</span> 2. Berkas Dokumen Fisik (ZimaOS Storage)
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  File yang terlampir akan disimpan permanen ke server ZimaOS.
                </p>

                {/* 1. CV / Resume */}
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: files.cv ? '1px solid #10b981' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      📄 1. CV / Curriculum Vitae
                    </span>
                    {files.cv && (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                        {formatBytes(files.cv.size)}
                      </span>
                    )}
                  </div>
                  {files.cv ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.cv.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('cv')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
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
                  border: files.ktp ? '1px solid #10b981' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🪪 2. Foto / Scan KTP
                    </span>
                    {files.ktp && (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                        {formatBytes(files.ktp.size)}
                      </span>
                    )}
                  </div>
                  {files.ktp ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.ktp.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('ktp')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
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
                  border: files.foto ? '1px solid #10b981' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🖼️ 3. Pas Foto Pelamar
                    </span>
                    {files.foto && (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                        {formatBytes(files.foto.size)}
                      </span>
                    )}
                  </div>
                  {files.foto ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.foto.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('foto')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
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
                  border: files.ijazah ? '1px solid #10b981' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🎓 4. Scan Ijazah / Transkrip Nilai
                    </span>
                    {files.ijazah && (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                        {formatBytes(files.ijazah.size)}
                      </span>
                    )}
                  </div>
                  {files.ijazah ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {files.ijazah.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveFile('ijazah')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
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
                  border: files.surat_lamaran || files.skck ? '1px solid #10b981' : '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      📑 5. Surat Lamaran / SKCK (Opsional)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {files.surat_lamaran ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#10b981' }}>Surat Lamaran: {files.surat_lamaran.name}</span>
                        <button type="button" onClick={() => handleRemoveFile('surat_lamaran')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange('surat_lamaran', e)}
                        style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                      />
                    )}

                    {files.skck ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#10b981' }}>SKCK: {files.skck.name}</span>
                        <button type="button" onClick={() => handleRemoveFile('skck')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
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

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: '8px',
                    padding: '14px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {submitting ? '💾 Sedang Menyimpan ke ZimaOS...' : '🚀 Simpan Pelamar & Upload Berkas ke ZimaOS'}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}

      {/* TAB 2: IMPORT MASSAL EXCEL */}
      {activeTab === 'bulk' && (
        <div className="card" style={{ padding: '30px' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Import Massal Data Pelamar via Spreadsheet
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
              Unggah file Excel (<code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>.xlsx</code> / <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>.csv</code>) untuk mendaftarkan banyak pelamar baru sekaligus. Sistem akan otomatis men-generate kode akses ujian untuk masing-masing kandidat.
            </p>

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
              textAlign: 'left'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Template Excel Standar Pelamar
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Gunakan format kolom yang sudah disesuaikan dengan database recruitment HRMv2.
                </div>
              </div>
              <a
                href={candidateApi.getTemplateExcelUrl()}
                download
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  fontWeight: 700,
                  fontSize: '12px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📥 Unduh Template (.xlsx)
              </a>
            </div>

            {/* Error Message */}
            {excelError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '20px',
                color: '#ef4444',
                fontSize: '13px',
                textAlign: 'left'
              }}>
                ⚠️ {excelError}
              </div>
            )}

            {/* Success Result */}
            {excelResult && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#10b981', marginBottom: '8px' }}>
                  🎉 {excelResult.message}
                </div>
                {excelResult.stats && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Total Baris: <strong>{excelResult.stats.total_rows}</strong> • Berhasil: <strong>{excelResult.stats.success_count}</strong> • Dilewati: <strong>{excelResult.stats.skipped_count}</strong>
                  </div>
                )}
                {excelResult.candidates && excelResult.candidates.length > 0 && (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>KANDIDAT BARU DITAMBAHKAN:</div>
                    {excelResult.candidates.map(c => (
                      <div key={c.id} style={{ fontSize: '12px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span>{c.name}</span>
                        <code style={{ color: '#f59e0b', fontWeight: 700 }}>{c.access_code}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dropzone & Upload Button */}
            <form onSubmit={handleUploadExcel}>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '14px',
                padding: '30px 20px',
                marginBottom: '20px',
                background: 'var(--bg-secondary)',
                cursor: 'pointer'
              }}>
                <input
                  type="file"
                  id="excel_input"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setExcelFile(e.target.files ? e.target.files[0] : null)}
                  style={{ display: 'none' }}
                />
                <label htmlFor="excel_input" style={{ cursor: 'pointer', display: 'block' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>📁</div>
                  {excelFile ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{excelFile.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatBytes(excelFile.size)} • Klik untuk ganti file</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Pilih File Excel / CSV</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Seret file ke sini atau klik untuk browse file dari komputer</div>
                    </div>
                  )}
                </label>
              </div>

              <button
                type="submit"
                disabled={!excelFile || uploadingExcel}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: !excelFile || uploadingExcel ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                }}
              >
                {uploadingExcel ? '⏳ Sedang Mengimpor Data...' : '📤 Mulai Import Data Pelamar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
