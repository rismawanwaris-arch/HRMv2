import React, { useState, useEffect } from 'react';
import API_BASE from '../config';

function HRDashboard({ onSelectCandidate, setView }) {
  const [stats, setStats] = useState({ total: 0, hired: 0, rejected: 0, active: 0, stages: {} });
  const [candidates, setCandidates] = useState([]);
  const [stagesList, setStagesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch stages
      const stagesRes = await fetch(`${API_BASE}/stages`);
      const stagesData = await stagesRes.json();
      if (stagesData.success) {
        setStagesList(stagesData.data.filter(s => s.is_active === 1));
      }

      // Fetch stats
      const statsRes = await fetch(`${API_BASE}/dashboard/stats`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Fetch active candidates for pipeline
      const listRes = await fetch(`${API_BASE}/candidates?status=Active`);
      const listData = await listRes.json();
      if (listData.success) {
        setCandidates(listData.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  };

  // Group active candidates by stage
  const getCandidatesInStage = (stageNum) => {
    return candidates.filter(c => c.current_stage === stageNum);
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (error) return <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monitoring Rekrutmen</h1>
          <p className="page-subtitle">Posisi: Retail Frontliner / Pramuniaga Konter</p>
        </div>
        <button className="btn btn-primary" onClick={() => setView('candidates')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          Kelola & Tambah Pelamar
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Total Pelamar</div>
          <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>{stats.total}</div>
          <div className="stat-card-desc">Pelamar masuk sistem</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}>
          <div className="stat-card-title">Sedang Proses</div>
          <div className="stat-card-value" style={{ color: 'var(--color-info)' }}>{stats.active}</div>
          <div className="stat-card-desc">Berada di salah satu alur seleksi</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div className="stat-card-title">Lolos / Diterima</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{stats.hired}</div>
          <div className="stat-card-desc">Karyawan berstatus Hired</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="stat-card-title">Gagal / Gugur</div>
          <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>{stats.rejected}</div>
          <div className="stat-card-desc">Kandidat tereliminasi</div>
        </div>
      </div>

      {/* Pipeline Kanban Board */}
      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: '700' }}>Pipeline Proses Seleksi</h2>
      <div className="pipeline-container">
        {stagesList.map(stage => {
          const stageCandidates = getCandidatesInStage(stage.id);
          return (
            <div key={stage.id} className="pipeline-col">
              <div className="pipeline-col-header">
                <span className="pipeline-col-title">{stage.name}</span>
                <span className="pipeline-col-badge">{stageCandidates.length}</span>
              </div>
              <div className="pipeline-cards-list">
                {stageCandidates.length === 0 ? (
                  <div style={{
                    fontSize: '11px', 
                    color: 'var(--text-muted)', 
                    textAlign: 'center', 
                    padding: '30px 10px',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '12px'
                  }}>
                    Kosong
                  </div>
                ) : (
                  stageCandidates.map(c => (
                    <div 
                      key={c.id} 
                      className="pipeline-card"
                      onClick={() => onSelectCandidate(c.id)}
                    >
                      <div className="pipeline-card-name">{c.name}</div>
                      <div className="pipeline-card-sub">
                        <span>NIK: {c.nik ? c.nik.substring(0, 8) + '...' : '-'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(c.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HRDashboard;
