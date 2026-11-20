import React, { useState, useEffect, useCallback } from 'react';
import { stageApi, dashboardApi, candidateApi } from '../services/api';

function formatShortDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function HRDashboard({ onSelectCandidate, setView }) {
  const [stats, setStats] = useState({ total: 0, hired: 0, rejected: 0, active: 0, stages: {} });
  const [candidates, setCandidates] = useState([]);
  const [stagesList, setStagesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [stagesData, statsData, listData] = await Promise.all([
        stageApi.getAll(),
        dashboardApi.getStats(),
        candidateApi.getAll({ status: 'Active' }),
      ]);
      if (stagesData?.success && Array.isArray(stagesData.data)) {
        setStagesList(stagesData.data.filter(s => s.is_active === 1));
      }
      if (statsData?.success && statsData.stats) {
        setStats(statsData.stats);
      }
      if (listData?.success && Array.isArray(listData.data)) {
        setCandidates(listData.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Group active candidates by stage
  const getCandidatesInStage = (stageNum) => {
    return candidates.filter(c => c.current_stage === stageNum);
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>
        <p style={{ marginBottom: '12px' }}>{error}</p>
        <button type="button" className="btn btn-primary" onClick={fetchDashboardData}>Coba Lagi</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monitoring Rekrutmen</h1>
          <p className="page-subtitle">Posisi: Retail Frontliner / Pramuniaga Konter</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setView('candidates')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          Kelola & Tambah Pelamar
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-card-title">Total Pelamar</div>
          <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>{stats.total || 0}</div>
          <div className="stat-card-desc">Pelamar masuk sistem</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-title">Sedang Proses</div>
          <div className="stat-card-value" style={{ color: 'var(--color-info)' }}>{stats.active || 0}</div>
          <div className="stat-card-desc">Berada di salah satu alur seleksi</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-title">Lolos / Diterima</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{stats.hired || 0}</div>
          <div className="stat-card-desc">Karyawan berstatus Hired</div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-title">Gagal / Gugur</div>
          <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>{stats.rejected || 0}</div>
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
                          {formatShortDate(c.created_at)}
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
