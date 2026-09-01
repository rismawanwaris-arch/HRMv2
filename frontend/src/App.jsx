import React, { useState, useEffect } from 'react';
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
import AttendanceManagement from './views/AttendanceManagement';
import PayrollManagement from './views/PayrollManagement';
import LaporanKeuanganKonter from './views/LaporanKeuanganKonter';
import LaporanKeuanganGudang from './views/LaporanKeuanganGudang';
import LaporanKonsolidasi from './views/LaporanKonsolidasi';
import Settings from './views/Settings';
import Discipline from './views/Discipline';
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
  const recruitmentViews = ['recruitment-dashboard', 'candidates', 'questions', 'training-questions', 'pipeline-settings', 'test', 'training-portal'];
  const [isRekrutmenOpen, setIsRekrutmenOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname === '/test' || window.location.pathname === '/training-portal' || params.has('code') || params.has('training_code');
  });
  const laporanViews = ['laporan-konter', 'laporan-gudang', 'laporan-konsolidasi'];
  const [isLaporanOpen, setIsLaporanOpen] = useState(() => {
    return window.location.pathname.includes('laporan');
  });

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));
  const [currentUsername, setCurrentUsername] = useState(() => localStorage.getItem('auth_username') || '');
  const [currentRole, setCurrentRole] = useState(() => localStorage.getItem('auth_role') || 'master');

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

  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
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

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_role');
    setIsAuthenticated(false);
    setCurrentUsername('');
    setCurrentRole('master');
    setView('dashboard');
  };

  // Access control helpers
  const canAccess = {
    rekrutmen:  ['staff', 'master'].includes(currentRole),
    karyawan:   ['finance', 'master'].includes(currentRole),
    cabang:     ['finance', 'master'].includes(currentRole),
    absensi:    true,
    payroll:    ['finance', 'master'].includes(currentRole),
    laporan:    ['finance', 'master'].includes(currentRole),
    settings:   currentRole === 'master',
    disiplin:   ['finance', 'master'].includes(currentRole),
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
        return <MasterDashboard setView={setView} />;
      case 'recruitment-dashboard':
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
        return canAccess.rekrutmen ? (
          <CandidateList
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              setView('detail');
            }}
          />
        ) : <Denied />;
      case 'employees':
        return canAccess.karyawan ? <EmployeeManagement /> : <Denied />;
      case 'employee-legacy':
        return canAccess.karyawan ? (
          <EmployeeData
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              setView('detail');
            }}
            setView={setView}
          />
        ) : <Denied />;
      case 'detail':
        return canAccess.rekrutmen ? (
          <CandidateDetail
            candidateId={selectedCandidateId}
            onBack={() => setView('candidates')}
          />
        ) : <Denied />;
      case 'branches':
        return canAccess.cabang ? <BranchManagement setView={setView} /> : <Denied />;
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
        return canAccess.laporan ? <LaporanKonsolidasi setView={setView} /> : <Denied />;
      case 'pipeline-settings':
        return canAccess.rekrutmen ? <StageManagement setView={setView} /> : <Denied />;
      case 'questions':
        return canAccess.rekrutmen ? <QuestionBank /> : <Denied />;
      case 'training-questions':
        return canAccess.rekrutmen ? <TrainingQuestionBank /> : <Denied />;
      case 'discipline':
        return canAccess.disiplin ? <Discipline /> : <Denied />;
      default:
        return (
          <HRDashboard
            onSelectCandidate={(id) => {
              setSelectedCandidateId(id);
              setView('detail');
            }}
            setView={setView}
          />
        );
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
            {canAccess.karyawan && <li
              className={`sidebar-item ${view === 'employees' ? 'active' : ''}`}
              onClick={() => setView('employees')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: 'var(--color-success)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
              Data Karyawan
            </li>}

            {canAccess.cabang && <li
              className={`sidebar-item ${view === 'branches' ? 'active' : ''}`}
              onClick={() => setView('branches')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#f59e0b' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              Cabang Outlet
            </li>}
            <li
              className={`sidebar-item ${view === 'attendance' ? 'active' : ''}`}
              onClick={() => setView('attendance')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#3b82f6' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
              Absensi
            </li>
            {canAccess.payroll && <li
              className={`sidebar-item ${view === 'payroll' ? 'active' : ''}`}
              onClick={() => setView('payroll')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#10b981' }}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Payroll & Slip Gaji
            </li>}
            {canAccess.disiplin && <li
              className={`sidebar-item ${view === 'discipline' ? 'active' : ''}`}
              onClick={() => setView('discipline')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#ef4444' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Disiplin & Pelanggaran
            </li>}
            {/* ── LAPORAN KEUANGAN GROUP ── */}
            {canAccess.laporan && <>
            <li
              className={`sidebar-item${laporanViews.includes(view) ? ' active' : ''}`}
              onClick={() => setIsLaporanOpen(p => !p)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#06b6d4' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span>Laporan Keuangan</span>
              </div>
              <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isLaporanOpen ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)', marginRight: '4px' }}>▶</span>
            </li>
            {isLaporanOpen && (
              <ul style={{ listStyle: 'none', margin: '2px 0 4px', padding: '0', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid rgba(6,182,212,0.3)', marginLeft: '12px', paddingLeft: '8px' }}>
                <li
                  className={`sidebar-item ${view === 'laporan-konter' ? 'active' : ''}`}
                  onClick={() => setView('laporan-konter')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  Laporan Konter
                </li>
                <li
                  className={`sidebar-item ${view === 'laporan-gudang' ? 'active' : ''}`}
                  onClick={() => setView('laporan-gudang')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                  Laporan Gudang
                </li>
                <li
                  className={`sidebar-item ${view === 'laporan-konsolidasi' ? 'active' : ''}`}
                  onClick={() => setView('laporan-konsolidasi')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Konsolidasi Semua Lokasi
                </li>
              </ul>
            )}
            </>}
            {canAccess.settings && <li
              className={`sidebar-item ${view === 'settings' ? 'active' : ''}`}
              onClick={() => setView('settings')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#f59e0b' }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 17a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z"></path></svg>
              Pengaturan Sistem
            </li>}
            {/* ── REKRUTMEN GROUP ── */}
            {canAccess.rekrutmen && <>
            <li
              className={`sidebar-item${recruitmentViews.includes(view) ? ' active' : ''}`}
              onClick={() => setIsRekrutmenOpen(p => !p)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#a78bfa' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Rekrutmen</span>
              </div>
              <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: isRekrutmenOpen ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)', marginRight: '4px' }}>▶</span>
            </li>
            {isRekrutmenOpen && (
              <ul style={{ listStyle: 'none', margin: '2px 0 4px', padding: '0', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid rgba(167,139,250,0.3)', marginLeft: '12px', paddingLeft: '8px' }}>
                <li
                  className={`sidebar-item ${view === 'recruitment-dashboard' ? 'active' : ''}`}
                  onClick={() => setView('recruitment-dashboard')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                  Pipeline Rekrutmen
                </li>
                <li
                  className={`sidebar-item ${view === 'candidates' ? 'active' : ''}`}
                  onClick={() => setView('candidates')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Pelamar Kerja
                </li>
                <li
                  className={`sidebar-item ${view === 'questions' ? 'active' : ''}`}
                  onClick={() => setView('questions')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  Bank Soal Ujian
                </li>
                <li
                  className={`sidebar-item ${view === 'training-questions' ? 'active' : ''}`}
                  onClick={() => setView('training-questions')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  Bank Soal Training
                </li>
                <li
                  className={`sidebar-item ${view === 'pipeline-settings' ? 'active' : ''}`}
                  onClick={() => setView('pipeline-settings')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#8b5cf6' }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Pengaturan Pipeline
                </li>
                <li
                  className={`sidebar-item ${view === 'test' ? 'active' : ''}`}
                  onClick={() => setView('test')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Portal Ujian Kandidat
                </li>
                <li
                  className={`sidebar-item ${view === 'training-portal' ? 'active' : ''}`}
                  onClick={() => setView('training-portal')}
                  style={{ fontSize: '13px', padding: '8px 10px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
                  Portal Ujian Training
                </li>
              </ul>
            )}
            </>}
          </ul>
        </nav>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          {/* Profile / Logout Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '11px', flexShrink: 0 }}>
                {currentUsername.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUsername}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                    padding: '1px 6px', borderRadius: '4px',
                    background: currentRole === 'master' ? '#7c3aed22' : currentRole === 'finance' ? '#10b98122' : '#3b82f622',
                    color:      currentRole === 'master' ? '#a78bfa'  : currentRole === 'finance' ? '#34d399'  : '#60a5fa',
                    border: `1px solid ${currentRole === 'master' ? '#7c3aed44' : currentRole === 'finance' ? '#10b98144' : '#3b82f644'}`,
                  }}>{currentRole}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setShowProfileModal(true); setPwError(''); setPwSuccess(''); setOldPassword(''); setNewPassword(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', borderRadius: '7px', transition: 'all 0.2s', width: '100%', textAlign: 'left', fontSize: '11px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
              Ganti Password
            </button>

            <button
              onClick={toggleTheme}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 8px', borderRadius: '7px', transition: 'all 0.2s', width: '100%', textAlign: 'left', fontSize: '11px' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {theme === 'dark' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            <button
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', borderRadius: '7px', transition: 'all 0.2s', width: '100%', textAlign: 'left', fontSize: '11px' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
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
