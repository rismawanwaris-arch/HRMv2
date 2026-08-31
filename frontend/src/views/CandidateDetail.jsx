import React, { useState, useEffect } from 'react';
import API_BASE from '../config';
import { candidateApi, adminTrainingApi, stageApi } from '../services/api';
import Stage1Admin from '../components/CandidateStages/Stage1Admin';
import Stage2Written from '../components/CandidateStages/Stage2Written';
import Stage3Simulation from '../components/CandidateStages/Stage3Simulation';
import Stage4HRD from '../components/CandidateStages/Stage4HRD';
import Stage5User from '../components/CandidateStages/Stage5User';
import Stage6MCU from '../components/CandidateStages/Stage6MCU';
import Stage7Offering from '../components/CandidateStages/Stage7Offering';
import Stage8Onboarding from '../components/CandidateStages/Stage8Onboarding';
import StageGeneric from '../components/CandidateStages/StageGeneric';


function CandidateDetail({ candidateId, onBack }) {
  const [candidate, setCandidate] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null); // 1 to 8 or dynamic IDs

  // Form states per stage
  const [stage1Data, setStage1Data] = useState({ berkas_lengkap: 0, usia_sesuai: 0, pendidikan_sesuai: 0, skck_bersih: 0, domisili_sesuai: 0, phone_screen_notes: '', passed: 0 });
  const [stage2Data, setStage2Data] = useState({ score_numerik: 0, score_situasional: 0, score_pengetahuan: 0, score_nominal: 0, total_score: 0, passed: 0 });
  const [stage3Data, setStage3Data] = useState({ score_upselling: 3, score_complaint: 3, score_queue: 3, evaluator: '', notes: '', passed: 0 });
  const [stage4Data, setStage4Data] = useState({ score_integritas: 3, score_pelayanan: 3, score_ketelitian: 3, score_belajar: 3, score_komunikasi: 3, score_budaya: 3, total_weighted_score: 3.0, notes: '', passed: 0 });
  const [stage5Data, setStage5Data] = useState({ decision: 'Pending', notes: '', passed: 0 });
  const [stage6Data, setStage6Data] = useState({ score_training: 0, test_completed_at: null, mcu_buta_warna: 0, mcu_kesehatan_umum: 0, mcu_bebas_narkoba: 0, ref_check_verified: 0, ref_check_notes: '', passed: 0 });
  const [stage7Data, setStage7Data] = useState({ contract_type: 'PKWT', salary_offered: 0, allowance: 0, bonus_scheme: '', start_date: '', offering_status: 'Pending', passed: 0 });
  const [onboardingData, setOnboardingData] = useState({ day_30_status: 'Pending', day_30_score: 0, day_30_notes: '', day_60_status: 'Pending', day_60_score: 0, day_60_notes: '', day_90_status: 'Pending', day_90_score: 0, day_90_notes: '', kpi_akurasi_transaksi: 100.0, kpi_kehadiran: 100.0, kpi_penguasaan_produk: 75.0, kpi_kepuasan_pelanggan: 0, kpi_laporan_harian: 100.0, kpi_upselling: 1.0 });
  const [genericStageData, setGenericStageData] = useState({ passed: 0, notes: '' });

  const builtInCodes = ['admin', 'written', 'simulation', 'interview_hrd', 'interview_user', 'mcu_ref', 'offering'];

  // Document Management States
  const [documents, setDocuments] = useState([]);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);

  const documentSlots = [
    { key: 'cv', label: 'CV / Resume', desc: 'Daftar riwayat hidup pelamar' },
    { key: 'ktp', label: 'KTP', desc: 'Kartu Tanda Penduduk' },
    { key: 'kk', label: 'Kartu Keluarga (KK)', desc: 'Kartu keluarga pelamar' },
    { key: 'ijazah', label: 'Ijazah / Transkrip', desc: 'Ijazah pendidikan terakhir' },
    { key: 'skck', label: 'Surat SKCK', desc: 'Surat Keterangan Catatan Kepolisian' },
    { key: 'pas_foto', label: 'Pas Foto Terbaru', desc: 'Pas foto berwarna' },
    { key: 'surat_sehat', label: 'Surat Keterangan Sehat', desc: 'Surat bebas penyakit / MCU' },
    { key: 'lainnya', label: 'Dokumen Tambahan', desc: 'Sertifikat / berkas pendukung' }
  ];

  useEffect(() => {
    const loadAllData = async () => {
      await fetchStages();
      await fetchCandidateDetail();
    };
    loadAllData();
  }, [candidateId]);

  const fetchStages = async () => {
    try {
      const res = await stageApi.getAll();
      if (res.success) {
        setStages(res.data.filter(s => s.is_active === 1));
      }
    } catch (err) {
      console.error('Error fetching stages:', err);
    }
  };

  // Synchronize stage form states when candidate details load
  useEffect(() => {
    if (candidate) {
      if (candidate.stage1) setStage1Data(candidate.stage1);
      if (candidate.stage2) setStage2Data(candidate.stage2);
      if (candidate.stage3) setStage3Data(candidate.stage3);
      if (candidate.stage4) setStage4Data(candidate.stage4);
      if (candidate.stage5) setStage5Data(candidate.stage5);
      if (candidate.stage6) setStage6Data(candidate.stage6);
      if (candidate.stage7) setStage7Data(candidate.stage7);
      if (candidate.onboarding) setOnboardingData(candidate.onboarding);
      if (candidate.documents) setDocuments(candidate.documents);

      // Automatically switch to current stage tab
      if (!activeTab) {
        if (candidate.status === 'Hired') {
          setActiveTab(8); // Onboarding tab
        } else {
          setActiveTab(candidate.current_stage);
        }
      }
    }
  }, [candidate]);

  useEffect(() => {
    if (candidate && activeTab && stages.length > 0) {
      const currentStageConfig = stages.find(s => s.id === activeTab);
      const isCustom = currentStageConfig && !builtInCodes.includes(currentStageConfig.code);
      if (isCustom) {
        const evalItem = (candidate.genericEvaluations || []).find(e => e.stage_id === activeTab);
        setGenericStageData(evalItem ? { passed: evalItem.passed, notes: evalItem.notes } : { passed: 0, notes: '' });
      }
    }
  }, [activeTab, candidate, stages]);

  const handleFileUpload = async (docKey, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Gagal: Ukuran file melebihi batas maksimum 5 MB!');
      e.target.value = '';
      return;
    }

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      alert('Gagal: Format file tidak didukung! Gunakan PDF, JPG, JPEG, atau PNG.');
      e.target.value = '';
      return;
    }

    try {
      setUploadingDocKey(docKey);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docKey);

      const data = await candidateApi.uploadDocument(candidateId, formData);
      if (data.success) {
        setDocuments(data.documents);
        // Auto check berkas_lengkap if cv, ktp, ijazah are present
        const hasCv = data.documents.some(d => d.doc_type === 'cv');
        const hasKtp = data.documents.some(d => d.doc_type === 'ktp');
        const hasIjazah = data.documents.some(d => d.doc_type === 'ijazah');
        if (hasCv && hasKtp && hasIjazah) {
          setStage1Data(p => ({ ...p, berkas_lengkap: 1 }));
        }
      } else {
        alert(data.message || 'Gagal mengunggah file.');
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert('Terjadi kesalahan saat mengunggah file.');
    } finally {
      setUploadingDocKey(null);
      e.target.value = '';
    }
  };

  const handleFileDelete = async (docId, docLabel) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus berkas "${docLabel}"?`)) return;
    try {
      const data = await candidateApi.deleteDocument(candidateId, docId);
      if (data.success) {
        setDocuments(data.documents);
      } else {
        alert(data.message || 'Gagal menghapus berkas.');
      }
    } catch (err) {
      console.error('File delete error:', err);
      alert('Gagal menghapus file.');
    }
  };

  const handleFilePreview = (docId) => {
    window.open(candidateApi.getDocumentUrl(candidateId, docId), '_blank');
  };

  const [trainingStatements, setTrainingStatements] = useState([]);

  useEffect(() => {
    fetchTrainingStatements();
  }, []);

  const fetchTrainingStatements = async () => {
    try {
      const data = await adminTrainingApi.getQuestions();
      if (data.success) {
        setTrainingStatements(data.questions);
      }
    } catch (err) {
      console.error('Error fetching training statements:', err);
    }
  };

  const fetchCandidateDetail = async () => {
    try {
      setLoading(true);
      const data = await candidateApi.getById(candidateId);
      if (data.success) {
        setCandidate(data.candidate);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
      setError('Gagal mengambil detail pelamar.');
    } finally {
      setLoading(false);
    }
  };

  const handleStageSubmit = async (stageNum, formData) => {
    try {
      const data = await candidateApi.updateStage(candidateId, stageNum, formData);
      if (data.success) {
        alert(`Data evaluasi Tahap ${stageNum} berhasil disimpan.`);
        fetchCandidateDetail();
      } else {
        alert(data.message || 'Gagal menyimpan data.');
      }
    } catch (err) {
      console.error('Stage save error:', err);
      alert('Koneksi server gagal.');
    }
  };

  const handleRejectCandidate = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menyatakan kandidat ini GUGUR (Rejected)? Tindakan ini akan menghentikan proses seleksi.')) return;
    try {
      const data = await candidateApi.updateStage(candidateId, activeTab, { status: 'Rejected' });
      if (data.success) {
        alert('Kandidat dinyatakan Gugur.');
        fetchCandidateDetail();
      }
    } catch (err) {
      console.error('Error rejecting candidate:', err);
    }
  };

  // Helper for copy exam link
  const copyExamLink = () => {
    const link = `http://localhost:5173/test?code=${candidate.access_code}`;
    navigator.clipboard.writeText(link)
      .then(() => alert('Tautan Ujian Online disalin ke clipboard:\n' + link))
      .catch(err => console.error('Failed to copy', err));
  };

  // Wawancara HRD Live Weighted Score Calculator
  const calcHRDWeightedScore = (s) => {
    const val = (s.score_integritas * 0.25) + 
                (s.score_pelayanan * 0.20) + 
                (s.score_ketelitian * 0.20) + 
                (s.score_belajar * 0.15) + 
                (s.score_komunikasi * 0.10) + 
                (s.score_budaya * 0.10);
    return parseFloat(val.toFixed(2));
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (error) return <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>;
  if (!candidate) return null;

  return (
    <div>
      {/* Detail Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Kembali
        </button>
        <div>
          <h1 className="page-title">{candidate.name}</h1>
          <p className="page-subtitle">Detail Profil & Rekam Evaluasi</p>
        </div>
      </div>

      {/* Dynamic Interactive Progress Tracker Header */}
      <div className="timeline-stages">
        {stages.map((stage, idx) => {
          let stepClass = '';
          const candidateCurrentStage = stages.find(s => s.id === candidate.current_stage);
          const currentOrder = candidateCurrentStage ? candidateCurrentStage.order_num : 999;
          
          if (candidate.status === 'Rejected' && stage.order_num >= currentOrder) {
            stepClass = 'rejected';
          } else if (currentOrder > stage.order_num || candidate.status === 'Hired') {
            stepClass = 'completed';
          } else if (candidate.current_stage === stage.id) {
            stepClass = 'active';
          }

          return (
            <div 
              key={stage.id} 
              className={`timeline-step ${activeTab === stage.id ? 'active' : ''} ${stepClass}`}
              onClick={() => setActiveTab(stage.id)}
            >
              <div className="timeline-step-icon">
                {stepClass === 'completed' ? '✓' : stepClass === 'rejected' ? '×' : idx + 1}
              </div>
              <span className="timeline-step-label">{stage.name}</span>
            </div>
          );
        })}
        {candidate.status === 'Hired' && (
          <div 
            className={`timeline-step ${activeTab === 8 ? 'active' : ''} completed`}
            onClick={() => setActiveTab(8)}
          >
            <div className="timeline-step-icon">★</div>
            <span className="timeline-step-label">Onboarding</span>
          </div>
        )}
      </div>

      {/* Main Grid: Info Sidebar & Dynamic Forms */}
      <div className="detail-grid">
        {/* Left Side: General Profile Summary Card */}
        <div className="glass-panel profile-card">
          <div className="profile-avatar">{candidate.name.charAt(0)}</div>
          <h3 className="profile-name">{candidate.name}</h3>
          
          <span className={`badge badge-${candidate.status.toLowerCase()}`}>
            {candidate.status === 'Active' ? 'Proses Seleksi' : candidate.status}
          </span>

          <div className="profile-meta-list">
            <div className="profile-meta-item">
              <span className="profile-meta-label">NIK</span>
              <span className="profile-meta-val">{candidate.nik || '-'}</span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">No. HP</span>
              <span className="profile-meta-val">{candidate.phone || '-'}</span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Email</span>
              <span className="profile-meta-val">{candidate.email || '-'}</span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Pendidikan</span>
              <span className="profile-meta-val">{candidate.education_level}</span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Buta Warna</span>
              <span className="profile-meta-val">{candidate.color_blind_test}</span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Kode Akses</span>
              <span className="profile-meta-val" style={{ fontFamily: 'monospace', color: 'var(--color-info)' }}>{candidate.access_code}</span>
            </div>
          </div>

          {candidate.status === 'Active' && (
            <button 
              className="btn btn-danger" 
              style={{ width: '100%', marginTop: '20px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              onClick={handleRejectCandidate}
            >
              Gugurkan Pelamar (Fail)
            </button>
          )}
        </div>

        {/* Right Side: Active Evaluation Tab form panels */}
        <div className="glass-panel eval-panel">
          {(() => {
            if (activeTab === 8) {
              return <Stage8Onboarding candidate={candidate} stageData={onboardingData} setStageData={setOnboardingData} handleStageSubmit={handleStageSubmit} />;
            }
            const currentStageConfig = stages.find(s => s.id === activeTab);
            if (!currentStageConfig) return null;

            switch (currentStageConfig.code) {
              case 'admin':
                return <Stage1Admin candidate={candidate} stageData={stage1Data} setStageData={setStage1Data} documents={documents} documentSlots={documentSlots} uploadingDocKey={uploadingDocKey} handleFileUpload={handleFileUpload} handleFilePreview={handleFilePreview} handleFileDelete={handleFileDelete} handleStageSubmit={handleStageSubmit} />;
              case 'written':
                return <Stage2Written candidate={candidate} stageData={stage2Data} setStageData={setStage2Data} handleStageSubmit={handleStageSubmit} copyExamLink={copyExamLink} />;
              case 'simulation':
                return <Stage3Simulation candidate={candidate} stageData={stage3Data} setStageData={setStage3Data} handleStageSubmit={handleStageSubmit} />;
              case 'interview_hrd':
                return <Stage4HRD candidate={candidate} stageData={stage4Data} setStageData={setStage4Data} handleStageSubmit={handleStageSubmit} calcHRDWeightedScore={calcHRDWeightedScore} />;
              case 'interview_user':
                return <Stage5User candidate={candidate} stageData={stage5Data} setStageData={setStage5Data} handleStageSubmit={handleStageSubmit} />;
              case 'mcu_ref':
                return <Stage6MCU candidate={candidate} stageData={stage6Data} setStageData={setStage6Data} handleStageSubmit={handleStageSubmit} trainingStatements={trainingStatements} />;
              case 'offering':
                return <Stage7Offering candidate={candidate} stageData={stage7Data} setStageData={setStage7Data} handleStageSubmit={handleStageSubmit} />;
              default:
                return (
                  <StageGeneric 
                    candidate={candidate}
                    stageId={currentStageConfig.id}
                    stageName={currentStageConfig.name}
                    stageData={genericStageData}
                    setStageData={setGenericStageData}
                    handleStageSubmit={handleStageSubmit}
                  />
                );
            }
          })()}
        </div>
              
      </div>
    </div>
  );
}

export default CandidateDetail;
