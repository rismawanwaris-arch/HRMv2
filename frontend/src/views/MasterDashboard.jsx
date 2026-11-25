import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { dashboardApi, settingsApi, branchApi } from '../services/api';

const fmtRp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export default function MasterDashboard({ setView, currentRole = 'master', canAccess = {} }) {
  const canManageBranches = canAccess.cabang ?? ['finance', 'master'].includes(currentRole);
  const canManageEmployees = canAccess.karyawan ?? ['finance', 'master'].includes(currentRole);
  const canManageSettings = canAccess.settings ?? currentRole === 'master';

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'employees' | 'branches' | 'settings'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    payroll_period_start_day: 29,
    payroll_period_end_day: 28,
    working_days_per_month: 25,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const settingsTimerRef = useRef(null);

  // Branch Quick Modal
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchForm, setBranchForm] = useState({
    code: '',
    name: '',
    city: '',
    location_type: 'Konter',
    has_petshop: false,
    rent_amount: '',
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchMsg, setBranchMsg] = useState(null);

  // Late Rule Quick Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    min_count: '',
    max_count: '',
    penalty_per_occurrence: '',
  });
  const [savingRule, setSavingRule] = useState(false);
  const [ruleMsg, setRuleMsg] = useState(null);

  useEffect(() => {
    return () => {
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showBranchModal && !showRuleModal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showBranchModal) { setShowBranchModal(false); setBranchMsg(null); }
        if (showRuleModal) { setShowRuleModal(false); setRuleMsg(null); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBranchModal, showRuleModal]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getMasterSummary();
      if (res.success) {
        setSummary(res.data);
        if (res.data.settings) {
          setSettingsForm({
            payroll_period_start_day: parseInt(res.data.settings.payroll_period_start_day, 10) || 29,
            payroll_period_end_day: parseInt(res.data.settings.payroll_period_end_day, 10) || 28,
            working_days_per_month: parseInt(res.data.settings.working_days_per_month, 10) || 25,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load master summary:', err);
      setError(err.message || 'Gagal memuat ringkasan data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const startDay = parseInt(settingsForm.payroll_period_start_day, 10);
    const endDay = parseInt(settingsForm.payroll_period_end_day, 10);
    const workDays = parseInt(settingsForm.working_days_per_month, 10);
    if (!startDay || !endDay || !workDays || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31 || workDays < 1 || workDays > 31) {
      setSettingsMsg({ type: 'err', text: 'Semua angka periode & hari kerja harus valid (1 - 31).' });
      return;
    }
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await settingsApi.updateSettings({
        payroll_period_start_day: startDay,
        payroll_period_end_day: endDay,
        working_days_per_month: workDays,
      });
      if (res.success) {
        setSettingsMsg({ type: 'ok', text: 'Pengaturan sistem berhasil disimpan!' });
        if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
        settingsTimerRef.current = setTimeout(() => setSettingsMsg(null), 3000);
        await loadData();
      } else {
        setSettingsMsg({ type: 'err', text: res.message || 'Gagal menyimpan pengaturan.' });
      }
    } catch (err) {
      setSettingsMsg({ type: 'err', text: err.message || 'Gagal terhubung ke server.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setSavingBranch(true);
    setBranchMsg(null);
    try {
      const payload = {
        ...branchForm,
        rent_amount: parseFloat(branchForm.rent_amount) || 0,
      };
      const res = await branchApi.create(payload);
      if (res.success) {
        setShowBranchModal(false);
        setBranchForm({ code: '', name: '', city: '', location_type: 'Konter', has_petshop: false, rent_amount: '' });
        await loadData();
      } else {
        setBranchMsg(res.message || 'Gagal menambahkan cabang.');
      }
    } catch (err) {
      setBranchMsg(err.message || 'Gagal membuat cabang.');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    const minVal = parseInt(ruleForm.min_count, 10);
    const maxVal = ruleForm.max_count === '' || ruleForm.max_count === null ? null : parseInt(ruleForm.max_count, 10);
    const penVal = parseFloat(ruleForm.penalty_per_occurrence) || 0;
    if (Number.isNaN(minVal) || minVal < 1) {
      setRuleMsg('Keterlambatan minimal (Dari Ke-) harus >= 1.');
      return;
    }
    if (maxVal !== null && (Number.isNaN(maxVal) || maxVal < minVal)) {
      setRuleMsg('Batas atas (Sampai Ke-) harus >= Dari Ke-.');
      return;
    }
    setSavingRule(true);
    setRuleMsg(null);
    try {
      const payload = {
        min_count: minVal,
        max_count: maxVal,
        penalty_per_occurrence: penVal,
      };
      const res = await settingsApi.createPenaltyRule(payload);
      if (res.success) {
        setShowRuleModal(false);
        setRuleForm({ min_count: '', max_count: '', penalty_per_occurrence: '' });
        await loadData();
      } else {
        setRuleMsg(res.message || 'Gagal menambah aturan denda.');
      }
    } catch (err) {
      setRuleMsg(err.message || 'Gagal menambah aturan denda.');
    } finally {
      setSavingRule(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  if (error || !summary) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-danger)' }}>
        <p>{error || 'Data tidak tersedia'}</p>
        <button type="button" onClick={loadData} className="btn btn-primary" style={{ marginTop: '10px' }}>Coba Lagi</button>
      </div>
    );
  }

  const {
    employees = {},
    branches = {},
    late_rules = [],
    contract_alerts = [],
    pending_approvals = {},
    turnover_analytics = {},
  } = summary;
  const branchListSafe = Array.isArray(branches.list) ? branches.list : [];

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Pusat Data & Pengaturan</h1>
          <p className="page-subtitle">Dashboard manajemen terpadu untuk Data Karyawan, Cabang Outlet, dan Pengaturan Sistem</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canManageBranches && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setBranchMsg(null); setShowBranchModal(true); }}
            >
              🏢 + Cabang Baru
            </button>
          )}
          {canManageEmployees && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setView('employees')}
            >
              👤 Kelola Karyawan
            </button>
          )}
        </div>
      </div>

      {/* Pending Candidate Promotion Banner */}
      {canManageEmployees && employees.pending_promotion > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🎉</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: '14px' }}>
                Ada {employees.pending_promotion} Kandidat Lulus Seleksi (Hired)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Kandidat yang telah menerima offering letter siap dipromosikan ke tabel Karyawan Aktif.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView('employees')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              background: '#f59e0b',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Promosikan Sekarang ➔
          </button>
        </div>
      )}

      {/* Contract & Probation Expiry Alert Banner */}
      {canManageEmployees && contract_alerts.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.14), rgba(245, 158, 11, 0.06))',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: '14px' }}>
              ⏰ {contract_alerts.length} Kontrak / Masa Probation Mendekati Berakhir
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {contract_alerts.slice(0, 3).map(a => `${a.name} (${a.alert_type === 'probation' ? 'Probation' : 'Kontrak'} ${a.days_remaining < 0 ? 'Expired' : `H-${a.days_remaining}`})`).join(' · ')}
              {contract_alerts.length > 3 ? ` · +${contract_alerts.length - 3} lainnya` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView('employees')}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            Kelola Kontrak ➔
          </button>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {/* Karyawan Card */}
        <div
          className="card stat-card"
          onClick={() => setActiveTab('employees')}
          style={{ padding: '18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Karyawan Aktif</span>
            <span style={{ fontSize: '18px' }}>👥</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-success)', marginBottom: '6px' }}>
            {employees.total || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>orang</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>Frontliner: <strong>{employees.frontliner || 0}</strong></span>
            <span>•</span>
            <span>Staff: <strong>{employees.staff || 0}</strong></span>
          </div>
        </div>

        {/* Cabang Card */}
        <div
          className="card stat-card"
          onClick={() => setActiveTab('branches')}
          style={{ padding: '18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cabang Outlet</span>
            <span style={{ fontSize: '18px' }}>🏢</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--color-info)', marginBottom: '6px' }}>
            {branches.total || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>lokasi</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span>Konter: <strong>{branches.konter || 0}</strong></span>
            <span>•</span>
            <span>Gudang: <strong>{branches.gudang || 0}</strong></span>
            {branches.kantor > 0 && <><span>•</span><span>Kantor: <strong>{branches.kantor}</strong></span></>}
            <span>•</span>
            <span>Petshop: <strong>{branches.petshop || 0}</strong></span>
          </div>
        </div>

        {/* Total Sewa Card */}
        <div
          className="card stat-card"
          onClick={() => setActiveTab('branches')}
          style={{ padding: '18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Beban Sewa Outlet</span>
            <span style={{ fontSize: '18px' }}>💰</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--color-warning)', marginBottom: '6px' }}>
            {fmtRp(branches.total_rent)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Estimasi total per bulan
          </div>
        </div>

        {/* Pengaturan Card */}
        <div
          className="card stat-card"
          onClick={() => setActiveTab('settings')}
          style={{ padding: '18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Periode & Denda</span>
            <span style={{ fontSize: '18px' }}>⚙️</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '6px' }}>
            Tgl {settingsForm.payroll_period_start_day} - {settingsForm.payroll_period_end_day}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Hari Kerja: <strong>{settingsForm.working_days_per_month} hari</strong> • Denda: <strong>{late_rules ? late_rules.length : 0} aturan</strong>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--bg-secondary)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        overflowX: 'auto'
      }}>
        {[
          { id: 'overview', label: '📊 Overview Terpadu' },
          ...(canManageEmployees ? [{ id: 'employees', label: `👥 Data Karyawan (${employees.total || 0})` }] : []),
          ...(canManageBranches ? [{ id: 'branches', label: `🏢 Cabang Outlet (${branches.total || 0})` }] : []),
          ...(canManageSettings ? [{ id: 'settings', label: '⚙️ Pengaturan & Denda ASBEN' }] : []),
        ].map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 150ms ease-out, color 150ms ease-out, scale 150ms ease-out'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW TERPADU */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pending Approvals Card & Turnover Snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                  📥 Antrean Persetujuan ({pending_approvals.total || 0})
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <button type="button" onClick={() => setView('leaves')} style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cuti &amp; Izin</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: (pending_approvals.leaves || 0) > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>{pending_approvals.leaves || 0}</div>
                </button>
                <button type="button" onClick={() => setView('claims')} style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lembur</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: (pending_approvals.overtime || 0) > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>{pending_approvals.overtime || 0}</div>
                </button>
                <button type="button" onClick={() => setView('claims')} style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reimburse</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: (pending_approvals.reimbursements || 0) > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>{pending_approvals.reimbursements || 0}</div>
                </button>
              </div>
            </div>

            {canManageEmployees && (
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                    📉 Analitik Turnover (90 Hari)
                  </h3>
                  <button type="button" onClick={() => setView('resigned-employees')} style={{ background: 'transparent', border: 'none', color: 'var(--color-warning)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Riwayat Resign ➔
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Turnover Rate</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-warning)' }}>{turnover_analytics.turnover_rate_pct ?? 0}%</div>
                  </div>
                  <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Keluar 90h</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-danger)' }}>{turnover_analytics.exits_last_90d ?? 0}</div>
                  </div>
                  <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rata2 Masa Kerja</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-info)' }}>{turnover_analytics.avg_tenure_months ?? 0} bln</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: '20px' }}>
          
          {/* Alokasi Staf per Cabang */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                🏢 Alokasi Staf per Cabang
              </h3>
              {canManageBranches && (
                <button
                  type="button"
                  onClick={() => setView('branches')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-info)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Lihat Semua ➔
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {branchListSafe.slice(0, 6).map(b => (
                <div key={b.id} style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {b.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({b.code})</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {b.city || 'Kota -'} • Tipe: {b.location_type} {b.has_petshop ? '• Ada Petshop' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: b.staff_count > 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: b.staff_count > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                      fontWeight: 700,
                      fontSize: '12px'
                    }}>
                      {b.staff_count} Staf
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Karyawan Terbaru & Quick Action */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                👥 Karyawan Terbaru
              </h3>
              {canManageEmployees && (
                <button
                  type="button"
                  onClick={() => setView('employees')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-success)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Data Lengkap ➔
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {employees.recent && employees.recent.length > 0 ? (
                employees.recent.map(e => (
                  <div key={e.id} style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {e.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {e.position || 'Staff'} • {e.branch_name || 'Tanpa Cabang'}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: e.employee_type === 'Frontliner' ? 'var(--color-info-bg)' : 'rgba(139,92,246,0.15)',
                      color: e.employee_type === 'Frontliner' ? 'var(--color-info)' : 'var(--color-primary)',
                    }}>
                      {e.employee_type}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  Belum ada data karyawan aktif.
                </div>
              )}
            </div>
          </div>

          </div>

          {/* Retention Early Warning & Top Resign Reasons (Finance/Master) */}
          {canManageEmployees && ((turnover_analytics.retention_risk_list?.length || 0) > 0 || (turnover_analytics.top_resign_reasons?.length || 0) > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '20px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                  🚨 Early Warning Risiko Resign / Kedisiplinan
                </h3>
                {(!turnover_analytics.retention_risk_list || turnover_analytics.retention_risk_list.length === 0) ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tidak ada karyawan dengan indikator risiko tinggi saat ini.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {turnover_analytics.retention_risk_list.map(r => (
                      <div key={r.id} style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{r.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {r.branch_name || '—'}</span></div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.factors.join(' · ')}</div>
                        </div>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: r.risk_level === 'Tinggi' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)', color: r.risk_level === 'Tinggi' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                          {r.risk_level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                  📊 Penyebab Keluar / Resign Terbanyak
                </h3>
                {(!turnover_analytics.top_resign_reasons || turnover_analytics.top_resign_reasons.length === 0) ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Belum ada data alasan keluar karyawan.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {turnover_analytics.top_resign_reasons.map(item => (
                      <div key={item.reason} style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.reason}</span>
                        <strong style={{ color: 'var(--color-warning)' }}>{item.count} orang</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DATA KARYAWAN */}
      {activeTab === 'employees' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Manajemen Karyawan
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Total {employees.total || 0} karyawan aktif terdaftar di sistem
              </p>
            </div>
            {canManageEmployees && (
              <button
                type="button"
                onClick={() => setView('employees')}
                className="btn btn-primary"
                style={{ padding: '9px 18px', fontSize: '13px' }}
              >
                👤 Buka Form & Tabel Karyawan Penuh ➔
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>TIPE KARYAWAN</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Frontliner (Konter):</span>
                <strong>{employees.frontliner || 0} orang</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Staff & Gudang:</span>
                <strong>{employees.staff || 0} orang</strong>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>STATUS KONTRAK</div>
              {employees.contracts && employees.contracts.map(c => (
                <div key={c.contract_type || 'unset'} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{c.contract_type || 'Belum Ditentukan'}:</span>
                  <strong>{c.count} orang</strong>
                </div>
              ))}
            </div>

            <div
              onClick={() => { if (canManageEmployees) setView('resigned-employees'); }}
              style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', cursor: canManageEmployees ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS NON-AKTIF</span>
                {canManageEmployees && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-warning)' }}>Lihat Detail ➔</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Resign:</span>
                <strong style={{ color: 'var(--color-warning)' }}>{employees.resign || 0} orang</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Terminated:</span>
                <strong style={{ color: 'var(--color-danger)' }}>{employees.terminated || 0} orang</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CABANG OUTLET */}
      {activeTab === 'branches' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Daftar Seluruh Cabang & Outlet
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Kelola data konter pulsa, gudang pusat, dan unit petshop
              </p>
            </div>
            {canManageBranches && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setBranchMsg(null); setShowBranchModal(true); }}
                  className="btn btn-primary"
                >
                  + Tambah Cabang
                </button>
                <button
                  type="button"
                  onClick={() => setView('branches')}
                  className="btn btn-secondary"
                >
                  Buka Manajemen Cabang Penuh ➔
                </button>
              </div>
            )}
          </div>

          {/* Branches Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '16px' }}>
            {branchListSafe.map(b => (
              <div key={b.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: 'var(--color-info-bg)',
                      color: 'var(--color-info)',
                      fontFamily: 'monospace'
                    }}>
                      {b.code}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: b.location_type === 'Gudang' ? 'rgba(139,92,246,0.15)' : 'var(--color-info-bg)',
                      color: b.location_type === 'Gudang' ? 'var(--color-primary)' : 'var(--color-info)'
                    }}>
                      {b.location_type}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--text-primary)' }}>{b.name}</h4>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    📍 {b.city || 'Kota -'} {b.has_petshop ? '• 🐾 Unit Petshop' : ''}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Biaya Sewa</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-warning)' }}>{fmtRp(b.rent_amount)}</div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: b.staff_count > 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                    color: b.staff_count > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {b.staff_count} Staf Aktif
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PENGATURAN SISTEM & DENDA ASBEN */}
      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '20px' }}>
          
          {/* Quick Settings Form */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚙️ Pengaturan Periode & Hari Kerja
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Parameter global untuk absensi harian dan perhitungan payroll bulanan
            </p>

            {settingsMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                background: settingsMsg.type === 'ok' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                color: settingsMsg.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
                border: `1px solid ${settingsMsg.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}>
                {settingsMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Tanggal Mulai Periode Penggajian:
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  disabled={!canManageSettings}
                  value={settingsForm.payroll_period_start_day}
                  onChange={e => setSettingsForm(p => ({ ...p, payroll_period_start_day: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Tanggal Akhir Periode Penggajian:
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  disabled={!canManageSettings}
                  value={settingsForm.payroll_period_end_day}
                  onChange={e => setSettingsForm(p => ({ ...p, payroll_period_end_day: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Hari Kerja Standar per Bulan (hari):
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  disabled={!canManageSettings}
                  value={settingsForm.working_days_per_month}
                  onChange={e => setSettingsForm(p => ({ ...p, working_days_per_month: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))}
                  required
                />
              </div>

              {canManageSettings ? (
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', marginTop: '6px' }}
                >
                  {savingSettings ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
                </button>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Hanya akun Master yang dapat mengubah pengaturan ini.
                </div>
              )}
            </form>
          </div>

          {/* Late Penalty Rules (ASBEN) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ⚠️ Aturan Denda ASBEN
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Denda otomatis keterlambatan jam masuk kerja
                </p>
              </div>
              {canManageSettings && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setRuleMsg(null); setShowRuleModal(true); }}
                  style={{ padding: '7px 12px', fontSize: '12px' }}
                >
                  + Tambah Aturan
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: '13px', marginTop: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Kejadian Ke-</th>
                    <th style={{ textAlign: 'right' }}>Denda per Kejadian</th>
                  </tr>
                </thead>
                <tbody>
                  {late_rules && late_rules.length > 0 ? (
                    late_rules.map(r => (
                      <tr key={r.id}>
                        <td>
                          Terlambat ke-<strong>{r.min_count}</strong> s/d <strong>{r.max_count !== null ? r.max_count : '∞'}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: r.penalty_per_occurrence === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {fmtRp(r.penalty_per_occurrence)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Belum ada aturan denda ASBEN.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {canManageSettings && (
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setView('settings')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Kelola Aturan Selengkapnya di Settings ➔
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* QUICK MODAL: TAMBAH CABANG */}
      {showBranchModal && createPortal(
        <div
          className="modal-overlay"
          onClick={() => { setShowBranchModal(false); setBranchMsg(null); }}
          style={{ padding: '20px', zIndex: 3000 }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto',
              overscrollBehavior: 'contain', padding: 0,
              background: 'var(--bg-surface-opaque)',
              borderRadius: '16px', border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.45)'
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Tambah Cabang Baru</h3>
              <button type="button" onClick={() => { setShowBranchModal(false); setBranchMsg(null); }} className="close-btn" aria-label="Tutup">×</button>
            </div>

            <form onSubmit={handleCreateBranch} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {branchMsg && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{branchMsg}</div>}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>KODE CABANG *</label>
                <input
                  type="text"
                  placeholder="JKT-01"
                  value={branchForm.code}
                  onChange={e => setBranchForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>NAMA CABANG *</label>
                <input
                  type="text"
                  placeholder="Cabang Sudirman"
                  value={branchForm.name}
                  onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TIPE LOKASI</label>
                  <select
                    value={branchForm.location_type}
                    onChange={e => setBranchForm(p => ({ ...p, location_type: e.target.value }))}
                  >
                    <option value="Konter">Konter</option>
                    <option value="Gudang">Gudang</option>
                    <option value="Kantor/Pusat">Kantor/Pusat</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>KOTA</label>
                  <input
                    type="text"
                    placeholder="Jakarta"
                    value={branchForm.city}
                    onChange={e => setBranchForm(p => ({ ...p, city: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>BIAYA SEWA BULANAN (RP)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={branchForm.rent_amount}
                  onChange={e => setBranchForm(p => ({ ...p, rent_amount: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="petshop_chk"
                  checked={branchForm.has_petshop}
                  onChange={e => setBranchForm(p => ({ ...p, has_petshop: e.target.checked }))}
                />
                <label htmlFor="petshop_chk" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: 0 }}>
                  Lokasi memiliki unit <strong>Petshop</strong>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowBranchModal(false); setBranchMsg(null); }}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBranch}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {savingBranch ? 'Menyimpan...' : 'Simpan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* QUICK MODAL: TAMBAH ATURAN DENDA */}
      {showRuleModal && createPortal(
        <div
          className="modal-overlay"
          onClick={() => { setShowRuleModal(false); setRuleMsg(null); }}
          style={{ padding: '20px', zIndex: 3000 }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto',
              overscrollBehavior: 'contain', padding: 0,
              background: 'var(--bg-surface-opaque)',
              borderRadius: '16px', border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.45)'
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Tambah Aturan Denda ASBEN</h3>
              <button type="button" onClick={() => { setShowRuleModal(false); setRuleMsg(null); }} className="close-btn" aria-label="Tutup">×</button>
            </div>

            <form onSubmit={handleCreateRule} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {ruleMsg && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{ruleMsg}</div>}

              <div className="responsive-grid-2" style={{ gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>DARI KE- *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={ruleForm.min_count}
                    onChange={e => setRuleForm(p => ({ ...p, min_count: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>SAMPAI KE-</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Kosong = ∞"
                    value={ruleForm.max_count}
                    onChange={e => setRuleForm(p => ({ ...p, max_count: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>DENDA PER KEJADIAN (RP) *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="25000"
                  value={ruleForm.penalty_per_occurrence}
                  onChange={e => setRuleForm(p => ({ ...p, penalty_per_occurrence: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowRuleModal(false); setRuleMsg(null); }}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {savingRule ? 'Menyimpan...' : 'Simpan Aturan'}
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
