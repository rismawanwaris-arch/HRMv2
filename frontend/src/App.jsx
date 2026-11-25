import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import MasterDashboard from './views/MasterDashboard';
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
import EmployeeManagement from './views/EmployeeManagement';
import ResignedEmployees from './views/ResignedEmployees';
import AttendanceManagement from './views/AttendanceManagement';
import PayrollManagement from './views/PayrollManagement';
import LaporanKeuanganKonter from './views/LaporanKeuanganKonter';
import LaporanKeuanganGudang from './views/LaporanKeuanganGudang';
import LaporanKonsolidasi from './views/LaporanKonsolidasi';
import Settings from './views/Settings';
import Discipline from './views/Discipline';
import UploadPelamar from './views/UploadPelamar';
import OutletActivity from './views/OutletActivity';
import AssetManagement from './views/AssetManagement';
import LeaveManagement from './views/LeaveManagement';
import LoanManagement from './views/LoanManagement';
import ClaimsAndTHR from './views/ClaimsAndTHR';
import Login from './views/Login';
import { authApi } from './services/api';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('UI Crash caught by ErrorBoundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Terjadi Kesalahan Tampilan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'left', fontFamily: 'monospace' }}>
            {this.state.error?.message || 'Gagal memuat komponen.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn btn-primary"
            style={{ padding: '10px 24px', fontWeight: 700 }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const recruitmentViews = ['recruitment-dashboard', 'upload-pelamar', 'candidates', 'questions', 'training-questions', 'pipeline-settings', 'test', 'training-portal'];
  const [isRekrutmenOpen, setIsRekrutmenOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname === '/test' || window.location.pathname === '/training-portal' || params.has('code') || params.has('training_code');
  });
  const laporanViews = ['laporan-konter', 'laporan-gudang', 'laporan-konsolidasi'];
  const [isLaporanOpen, setIsLaporanOpen] = useState(() => {
    return window.location.pathname.includes('laporan');
  });
  const hrServiceViews = ['leaves', 'loans', 'claims'];
  const [isHrServiceOpen, setIsHrServiceOpen] = useState(false);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));
  const [currentUsername, setCurrentUsername] = useState(() => localStorage.getItem('auth_username') || '');
  const [currentRole, setCurrentRole] = useState(() => localStorage.getItem('auth_role') || 'master');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Change Password state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const pwCloseTimerRef = useRef(null);

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const handleLogout = useCallback(() => {
    if (pwCloseTimerRef.current) {
      clearTimeout(pwCloseTimerRef.current);
      pwCloseTimerRef.current = null;
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_role');
    setIsAuthenticated(false);
    setCurrentUsername('');
    setCurrentRole('master');
    setShowProfileModal(false);
    setMobileMenuOpen(false);
    setSelectedCandidateId(null);
    setView('dashboard');
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
      if (pwCloseTimerRef.current) clearTimeout(pwCloseTimerRef.current);
    };
  }, [handleLogout]);

  useEffect(() => {
    if (!showProfileModal) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowProfileModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showProfileModal]);

  const navigate = (targetView) => {
    setView(targetView);
    setMobileMenuOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const style = document.createElement('style');
    style.append(document.createTextNode('*,*::before,*::after{transition:none !important}'));
    document.head.append(style);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('app_theme', next);
    setTheme(next);
    void document.body.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => style.remove());
    });
  };

  const handleLogin = (token, username, role = 'master') => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_username', username);
    localStorage.setItem('auth_role', role);
    setIsAuthenticated(true);
    setCurrentUsername(username);
    setCurrentRole(role);
    setView('dashboard');
  };

  // Access control helpers
  const canAccess = {
    rekrutmen:        ['staff', 'master'].includes(currentRole),
    karyawan:         ['finance', 'master'].includes(currentRole),
    cabang:           ['finance', 'master'].includes(currentRole),
    absensi:          true,
    payroll:          ['finance', 'master'].includes(currentRole),
    laporan:          ['finance', 'master'].includes(currentRole),
    settings:         currentRole === 'master',
    disiplin:         ['finance', 'master'].includes(currentRole),
    cuti:             true,
    pinjaman:         ['finance', 'master'].includes(currentRole),
    klaim:            true,
    aktivitas_outlet: true,
    assets:           true,
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!oldPassword || !newPassword) {
      setPwError('Mohon lengkapi semua bidang.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password baru minimal 8 karakter.');
      return;
    }

    try {
      setPwSubmitting(true);
      const data = await authApi.changePassword({ oldPassword, newPassword });
      if (data.success) {
        setPwSuccess('Password berhasil diubah.');
        setOldPassword('');
        setNewPassword('');
        if (pwCloseTimerRef.current) clearTimeout(pwCloseTimerRef.current);
        pwCloseTimerRef.current = setTimeout(() => {
          setShowProfileModal(false);
          pwCloseTimerRef.current = null;
        }, 1600);
      } else {
        setPwError(data.message || 'Gagal mengubah password.');
      }
    } catch (err) {
      setPwError(err.message || 'Gagal mengubah password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const Denied = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '48px' }}>🔒</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Akses Ditolak</div>
      <div style={{ fontSize: '14px' }}>Peran Anda tidak memiliki izin untuk halaman ini.</div>
    </div>
  );

  // Router logic
  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <MasterDashboard setView={navigate} currentRole={currentRole} canAccess={canAccess} />;
      case 'recruitment-dashboard':
        return canAccess.rekrutmen ? (
          <HRDashboard
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              navigate('detail');
            }}
            setView={navigate}
          />
        ) : <Denied />;
      case 'upload-pelamar':
        return canAccess.rekrutmen ? (
          <UploadPelamar
            setView={navigate}
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              navigate('detail');
            }}
          />
        ) : <Denied />;
      case 'candidates':
        return canAccess.rekrutmen ? (
          <CandidateList
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              navigate('detail');
            }}
            setView={navigate}
          />
        ) : <Denied />;
      case 'employees':
        return canAccess.karyawan ? <EmployeeManagement /> : <Denied />;
      case 'resigned-employees':
        return canAccess.karyawan ? <ResignedEmployees /> : <Denied />;
      case 'employee-legacy':
        return canAccess.karyawan ? (
          <EmployeeData
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              navigate('detail');
            }}
            canAccess={canAccess}
          />
        ) : <Denied />;
      case 'detail':
        return canAccess.rekrutmen ? (
          <CandidateDetail
            candidateId={selectedCandidateId}
            onBack={() => navigate('candidates')}
          />
        ) : <Denied />;
      case 'branches':
        return canAccess.cabang ? <BranchManagement /> : <Denied />;
      case 'settings':
        return canAccess.settings ? <Settings currentRole={currentRole} /> : <Denied />;
      case 'attendance':
        return <AttendanceManagement />;
      case 'payroll':
        return canAccess.payroll ? <PayrollManagement /> : <Denied />;
      case 'laporan-konter':
        return canAccess.laporan ? <LaporanKeuanganKonter /> : <Denied />;
      case 'laporan-gudang':
        return canAccess.laporan ? <LaporanKeuanganGudang /> : <Denied />;
      case 'laporan-konsolidasi':
        return canAccess.laporan ? <LaporanKonsolidasi setView={navigate} /> : <Denied />;
      case 'pipeline-settings':
        return canAccess.rekrutmen ? <StageManagement /> : <Denied />;
      case 'questions':
        return canAccess.rekrutmen ? <QuestionBank currentRole={currentRole} /> : <Denied />;
      case 'training-questions':
        return canAccess.rekrutmen ? <TrainingQuestionBank currentRole={currentRole} /> : <Denied />;
      case 'discipline':
        return canAccess.disiplin ? <Discipline /> : <Denied />;
      case 'leaves':
        return canAccess.cuti ? <LeaveManagement currentRole={currentRole} /> : <Denied />;
      case 'loans':
        return canAccess.pinjaman ? <LoanManagement /> : <Denied />;
      case 'claims':
        return canAccess.klaim ? <ClaimsAndTHR currentRole={currentRole} /> : <Denied />;
      case 'outlet-activity':
        return <OutletActivity />;
      case 'assets':
        return <AssetManagement />;
      default:
        return <MasterDashboard setView={navigate} currentRole={currentRole} canAccess={canAccess} />;
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
      {/* Mobile Top Header (Visible on phone screens) */}
      <div className="mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '54px',
        background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 999, backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 10px',
              cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Toggle Menu"
          >
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="sidebar-logo-icon" style={{ width: '26px', height: '26px', fontSize: '14px' }}>H</div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>HRMv2</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{currentUsername}</span>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Admin Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="sidebar-logo-icon">H</div>
            <span className="sidebar-logo-text">Cv. Asya Bisnis Indonesia</span>
          </div>
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}
            >
              ✕
            </button>
          )}
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="sidebar-menu">
            <li
              className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('dashboard')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
              Dashboard
            </li>
            {canAccess.karyawan && <li
              className={`sidebar-item ${view === 'employees' ? 'active' : ''}`}
              onClick={() => navigate('employees')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-success)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
              Data Karyawan
            </li>}

            {canAccess.karyawan && <li
              className={`sidebar-item ${view === 'resigned-employees' ? 'active' : ''}`}
              onClick={() => navigate('resigned-employees')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>
              Karyawan Resign & Keluar
            </li>}

            {canAccess.cabang && <li
              className={`sidebar-item ${view === 'branches' ? 'active' : ''}`}
              onClick={() => navigate('branches')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              Cabang Outlet
            </li>}

            {canAccess.aktivitas_outlet && <li
              className={`sidebar-item ${view === 'outlet-activity' ? 'active' : ''}`}
              onClick={() => navigate('outlet-activity')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Aktivitas GA & Audit
            </li>}

            {canAccess.assets && <li
              className={`sidebar-item ${view === 'assets' ? 'active' : ''}`}
              onClick={() => navigate('assets')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              Inventaris & Aset GA
            </li>}
            <li
              className={`sidebar-item ${view === 'attendance' ? 'active' : ''}`}
              onClick={() => navigate('attendance')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
              Absensi
            </li>
            {canAccess.payroll && <li
              className={`sidebar-item ${view === 'payroll' ? 'active' : ''}`}
              onClick={() => navigate('payroll')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Payroll & Slip Gaji
            </li>}
            {canAccess.disiplin && <li
              className={`sidebar-item ${view === 'discipline' ? 'active' : ''}`}
              onClick={() => navigate('discipline')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ef4444' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Disiplin & Pelanggaran
            </li>}
            {/* ── LAYANAN HR & KLAIM GROUP (SunFish HR Modules) ── */}
            <li style={{ listStyle: 'none' }}>
              <div
                className={`sidebar-item${hrServiceViews.includes(view) ? ' active' : ''}`}
                onClick={() => setIsHrServiceOpen(p => !p)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#14b8a6' }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>
                  <span>Layanan HR & Klaim</span>
                </div>
                <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isHrServiceOpen ? 'rotate(90deg)' : 'none', color: 'inherit', opacity: 0.7, marginRight: '4px' }}>▶</span>
              </div>
              {isHrServiceOpen && (
                <ul className="sidebar-submenu" style={{ listStyle: 'none', margin: '2px 0 4px', padding: '0', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid rgba(20,184,166,0.35)', marginLeft: '12px', paddingLeft: '8px' }}>
                  <li
                    className={`sidebar-item ${view === 'leaves' ? 'active' : ''}`}
                    onClick={() => navigate('leaves')}
                    style={{ fontSize: '13px', padding: '8px 10px' }}
                  >
                    Cuti & Saldo Cuti
                  </li>
                  {canAccess.pinjaman && (
                    <li
                      className={`sidebar-item ${view === 'loans' ? 'active' : ''}`}
                      onClick={() => navigate('loans')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      Kasbon & Pinjaman
                    </li>
                  )}
                  <li
                    className={`sidebar-item ${view === 'claims' ? 'active' : ''}`}
                    onClick={() => navigate('claims')}
                    style={{ fontSize: '13px', padding: '8px 10px' }}
                  >
                    Lembur, Klaim & THR
                  </li>
                </ul>
              )}
            </li>
            {/* ── LAPORAN KEUANGAN GROUP ── */}
            {canAccess.laporan && (
              <li style={{ listStyle: 'none' }}>
                <div
                  className={`sidebar-item${laporanViews.includes(view) ? ' active' : ''}`}
                  onClick={() => setIsLaporanOpen(p => !p)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#06b6d4' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span>Laporan Keuangan</span>
                  </div>
                  <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isLaporanOpen ? 'rotate(90deg)' : 'none', color: 'inherit', opacity: 0.7, marginRight: '4px' }}>▶</span>
                </div>
                {isLaporanOpen && (
                  <ul className="sidebar-submenu" style={{ listStyle: 'none', margin: '2px 0 4px', padding: '0', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid rgba(6,182,212,0.3)', marginLeft: '12px', paddingLeft: '8px' }}>
                    <li
                      className={`sidebar-item ${view === 'laporan-konter' ? 'active' : ''}`}
                      onClick={() => navigate('laporan-konter')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                      Laporan Konter
                    </li>
                    <li
                      className={`sidebar-item ${view === 'laporan-gudang' ? 'active' : ''}`}
                      onClick={() => navigate('laporan-gudang')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                      Laporan Gudang
                    </li>
                    <li
                      className={`sidebar-item ${view === 'laporan-konsolidasi' ? 'active' : ''}`}
                      onClick={() => navigate('laporan-konsolidasi')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      Konsolidasi Semua Lokasi
                    </li>
                  </ul>
                )}
              </li>
            )}
            {canAccess.settings && <li
              className={`sidebar-item ${view === 'settings' ? 'active' : ''}`}
              onClick={() => navigate('settings')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Pengaturan Sistem
            </li>}
            {/* ── REKRUTMEN GROUP ── */}
            {canAccess.rekrutmen && (
              <li style={{ listStyle: 'none' }}>
                <div
                  className={`sidebar-item${recruitmentViews.includes(view) ? ' active' : ''}`}
                  onClick={() => setIsRekrutmenOpen(p => !p)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a78bfa' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span>Rekrutmen</span>
                  </div>
                  <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isRekrutmenOpen ? 'rotate(90deg)' : 'none', color: 'inherit', opacity: 0.7, marginRight: '4px' }}>▶</span>
                </div>
                {isRekrutmenOpen && (
                  <ul className="sidebar-submenu" style={{ listStyle: 'none', margin: '2px 0 4px', padding: '0', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid rgba(167,139,250,0.3)', marginLeft: '12px', paddingLeft: '8px' }}>
                    <li
                      className={`sidebar-item ${view === 'recruitment-dashboard' ? 'active' : ''}`}
                      onClick={() => navigate('recruitment-dashboard')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                      Pipeline Rekrutmen
                    </li>
                    <li
                      className={`sidebar-item ${view === 'upload-pelamar' ? 'active' : ''}`}
                      onClick={() => navigate('upload-pelamar')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Upload Pelamar Baru
                    </li>
                    <li
                      className={`sidebar-item ${view === 'candidates' ? 'active' : ''}`}
                      onClick={() => navigate('candidates')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      Pelamar Kerja
                    </li>
                    <li
                      className={`sidebar-item ${view === 'questions' ? 'active' : ''}`}
                      onClick={() => navigate('questions')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      Bank Soal Ujian
                    </li>
                    <li
                      className={`sidebar-item ${view === 'training-questions' ? 'active' : ''}`}
                      onClick={() => navigate('training-questions')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      Bank Soal Training
                    </li>
                    <li
                      className={`sidebar-item ${view === 'pipeline-settings' ? 'active' : ''}`}
                      onClick={() => navigate('pipeline-settings')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8b5cf6' }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      Pengaturan Pipeline
                    </li>
                    <li
                      className={`sidebar-item ${view === 'test' ? 'active' : ''}`}
                      onClick={() => navigate('test')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Portal Ujian Kandidat
                    </li>
                    <li
                      className={`sidebar-item ${view === 'training-portal' ? 'active' : ''}`}
                      onClick={() => navigate('training-portal')}
                      style={{ fontSize: '13px', padding: '8px 10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
                      Portal Ujian Training
                    </li>
                  </ul>
                )}
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          {/* Profile / Logout Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '11px', flexShrink: 0 }}>
                {(currentUsername || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUsername}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className={`role-badge role-badge--${['master', 'finance', 'staff'].includes(currentRole) ? currentRole : 'staff'}`}>{currentRole}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setShowProfileModal(true); setMobileMenuOpen(false); setPwError(''); setPwSuccess(''); setOldPassword(''); setNewPassword(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', borderRadius: '7px', transition: 'background-color 150ms ease-out, color 150ms ease-out, scale 150ms ease-out', width: '100%', textAlign: 'left', fontSize: '11px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
              Ganti Password
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', borderRadius: '7px', transition: 'background-color 150ms ease-out, color 150ms ease-out, scale 150ms ease-out', width: '100%', textAlign: 'left', fontSize: '11px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="icon-swap-grid">
                <span className={`icon-swap-layer ${theme === 'dark' ? 'is-shown' : 'is-hidden'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                </span>
                <span className={`icon-swap-layer ${theme === 'light' ? 'is-shown' : 'is-hidden'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </span>
              </span>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '6px 8px', borderRadius: '7px', transition: 'background-color 150ms ease-out, color 150ms ease-out, scale 150ms ease-out', width: '100%', textAlign: 'left', fontSize: '11px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--color-danger-bg)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Logout
            </button>
          </div>

          <p>© 2026 Konter Pulsa HR · v1.0.0</p>
        </div>
      </aside>

      {/* Admin Content Area */}
      <main className="main-content">
        <ErrorBoundary key={view}>
          <div key={view} className="view-transition-wrapper">
            {renderView()}
          </div>
        </ErrorBoundary>
      </main>

      {/* Change Password Modal (Portal) */}
      {showProfileModal && createPortal(
        <div
          className="modal-overlay"
          style={{ padding: '20px', zIndex: 3000 }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '400px', padding: 0,
              background: 'var(--bg-surface-opaque)',
              border: '1px solid var(--border-color)', borderRadius: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Ganti Password</h2>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="close-btn"
                aria-label="Tutup"
              >×</button>
            </div>

            <form onSubmit={handleChangePassword} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pwError && <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(239,68,68,0.3)' }}>{pwError}</div>}
              {pwSuccess && <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(16,185,129,0.3)' }}>{pwSuccess}</div>}

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>Password Lama</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>Password Baru (Min. 8 karakter)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  minLength={8}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={pwSubmitting}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '4px' }}
              >
                {pwSubmitting ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default App;
