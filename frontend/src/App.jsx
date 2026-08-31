import React, { useState, useEffect } from 'react';
import HRDashboard from './views/HRDashboard';
import CandidateList from './views/CandidateList';
import EmployeeData from './views/EmployeeData';
import CandidateDetail from './views/CandidateDetail';
import CandidateTest from './views/CandidateTest';
import QuestionBank from './views/QuestionBank';
import TrainingQuestionBank from './views/TrainingQuestionBank';
import TrainingTestPortal from './views/TrainingTestPortal';
import BranchManagement from './views/BranchManagement';
import StageManagement from './views/StageManagement';
import Login from './views/Login';
import API_BASE from './config';

function App() {
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === '/test' || params.has('code')) {
      return 'test';
    }
    if (window.location.pathname === '/training-portal' || params.has('training_code')) {
      return 'training-portal';
    }
    return 'dashboard';
  });
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isPortalDropdownOpen, setIsPortalDropdownOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname === '/test' || window.location.pathname === '/training-portal' || params.has('code') || params.has('training_code');
  });
  const [isQuestionsDropdownOpen, setIsQuestionsDropdownOpen] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('view') === 'questions' || p.get('view') === 'training-questions';
  });

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));
  const [currentUsername, setCurrentUsername] = useState(() => localStorage.getItem('auth_username') || '');

  // Change Password state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogin = (token, username) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_username', username);
    setIsAuthenticated(true);
    setCurrentUsername(username);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    setIsAuthenticated(false);
    setCurrentUsername('');
    setView('dashboard'); // Will fall back to login due to auth check
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!oldPassword || !newPassword) {
      setPwError('Mohon lengkapi semua bidang.');
      return;
    }

    try {
      setPwSubmitting(true);
      const res = await fetch(`${API_BASE}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername, oldPassword, newPassword })
      });
      const data = await res.json();

      if (data.success) {
        setPwSuccess('Password berhasil diubah.');
        setOldPassword('');
        setNewPassword('');
        setTimeout(() => setShowProfileModal(false), 2000);
      } else {
        setPwError(data.message || 'Gagal mengubah password.');
      }
    } catch (err) {
      setPwError('Gagal terhubung ke server.');
    } finally {
      setPwSubmitting(false);
    }
  };

  // Router logic
  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <HRDashboard
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              setView('detail');
            }}
            setView={setView}
          />
        );
      case 'candidates':
        return (
          <CandidateList
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              setView('detail');
            }}
          />
        );
      case 'employees':
        return (
          <EmployeeData
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              setView('detail');
            }}
            setView={setView}
          />
        );
      case 'detail':
        return (
          <CandidateDetail
            candidateId={selectedCandidateId}
            onBack={() => setView('candidates')}
          />
        );
      case 'branches':
        return <BranchManagement setView={setView} />;
      case 'pipeline-settings':
        return <StageManagement setView={setView} />;
      case 'questions':
        return <QuestionBank />;
      case 'training-questions':
        return <TrainingQuestionBank />;
      default:
        return <HRDashboard onSelectCandidate={(id) => {
          setSelectedCandidateId(id);
          setView('detail');
        }} />;
    }
  };

  // Dedicated full-screen Candidate Test Portal
  if (view === 'test') {
    return <CandidateTest onExit={() => setView('dashboard')} />;
  }

  // Dedicated full-screen Training Evaluation Portal
  if (view === 'training-portal') {
    return <TrainingTestPortal onExit={() => setView('dashboard')} />;
  }

  // Login Check
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} setView={setView} />;
  }

  return (
    <div className="app-container">
      {/* Admin Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">H</div>
          <span className="sidebar-logo-text">Cv. Asya Bisnis Indonesia</span>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="sidebar-menu">
            <li
              className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => setView('dashboard')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
              Dashboard
            </li>
            <li
              className={`sidebar-item ${view === 'candidates' ? 'active' : ''}`}
              onClick={() => setView('candidates')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Pelamar Kerja
            </li>
            <li
              className={`sidebar-item ${view === 'employees' ? 'active' : ''}`}
              onClick={() => setView('employees')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: 'var(--color-success)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
              Data Karyawan
            </li>

            <li
              className={`sidebar-item ${view === 'branches' ? 'active' : ''}`}
              onClick={() => setView('branches')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#f59e0b' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              Cabang Outlet
            </li>
            <li
              className="sidebar-item"
              onClick={() => setIsQuestionsDropdownOpen(!isQuestionsDropdownOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                <span>Bank Soal</span>
              </div>
              <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isQuestionsDropdownOpen ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}>▶</span>
            </li>
            {isQuestionsDropdownOpen && (
              <ul style={{ listStyle: 'none', paddingLeft: '16px', margin: '4px 0 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li
                  className={`sidebar-item ${view === 'questions' ? 'active' : ''}`}
                  onClick={() => setView('questions')}
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  Bank Soal Ujian
                </li>
                <li
                  className={`sidebar-item ${view === 'training-questions' ? 'active' : ''}`}
                  onClick={() => setView('training-questions')}
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                  Bank Soal Training
                </li>
              </ul>
            )}
            <li
              className={`sidebar-item ${view === 'pipeline-settings' ? 'active' : ''}`}
              onClick={() => setView('pipeline-settings')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#8b5cf6' }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Pengaturan Pipeline
            </li>
            <li
              className="sidebar-item"
              onClick={() => setIsPortalDropdownOpen(!isPortalDropdownOpen)}
              style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: 'var(--secondary)' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span>Portal Ujian</span>
              </div>
              <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isPortalDropdownOpen ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}>▶</span>
            </li>
            {isPortalDropdownOpen && (
              <ul style={{ listStyle: 'none', paddingLeft: '16px', margin: '4px 0 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li
                  className={`sidebar-item ${view === 'test' ? 'active' : ''}`}
                  onClick={() => setView('test')}
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                  Portal Ujian Kandidat
                </li>
                <li
                  className={`sidebar-item ${view === 'training-portal' ? 'active' : ''}`}
                  onClick={() => setView('training-portal')}
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 6v6l4 2"></path></svg>
                  Portal Ujian Training
                </li>
              </ul>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          {/* Profile / Logout Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>
                {currentUsername.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUsername}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Administrator</div>
              </div>
            </div>

            <button
              onClick={() => { setShowProfileModal(true); setPwError(''); setPwSuccess(''); setOldPassword(''); setNewPassword(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', width: '100%', textAlign: 'left', fontSize: '12px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
              Ganti Password
            </button>

            <button
              onClick={toggleTheme}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', width: '100%', textAlign: 'left', fontSize: '12px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            <button
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', width: '100%', textAlign: 'left', fontSize: '12px' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Logout
            </button>
          </div>

          <p>© 2026 Konter Pulsa HR</p>
          <p style={{ fontSize: '10px', marginTop: '4px' }}>v1.0.0</p>
        </div>
      </aside>

      {/* Admin Content Area */}
      <main className="main-content">
        {renderView()}
      </main>

      {/* Change Password Modal */}
      {showProfileModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '380px',
            background: 'linear-gradient(160deg, rgba(15,15,30,0.98) 0%, rgba(20,12,40,0.98) 100%)',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: '24px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'white' }}>Ganti Password</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '20px' }}
              >×</button>
            </div>

            <form onSubmit={handleChangePassword} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pwError && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '10px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(239,68,68,0.3)' }}>{pwError}</div>}
              {pwSuccess && <div style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '10px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(16,185,129,0.3)' }}>{pwSuccess}</div>}

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Password Lama</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={pwSubmitting}
                style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', cursor: pwSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, marginTop: '8px' }}
              >
                {pwSubmitting ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
