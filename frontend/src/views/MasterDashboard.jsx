import React, { useState, useEffect, useCallback } from 'react';
import { dashboardApi, settingsApi, branchApi, staffApi } from '../services/api';

const fmt = (n) => new Intl.NumberFormat('id-ID').format(n || 0);
const fmtRp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export default function MasterDashboard({ setView }) {
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
      setError('Gagal memuat ringkasan data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await settingsApi.updateSettings(settingsForm);
      if (res.success) {
        setSettingsMsg({ type: 'ok', text: 'Pengaturan sistem berhasil disimpan!' });
        setTimeout(() => setSettingsMsg(null), 3000);
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
    setSavingRule(true);
    setRuleMsg(null);
    try {
      const payload = {
        min_count: parseInt(ruleForm.min_count, 10),
        max_count: ruleForm.max_count === '' || ruleForm.max_count === null ? null : parseInt(ruleForm.max_count, 10),
        penalty_per_occurrence: parseFloat(ruleForm.penalty_per_occurrence) || 0,
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
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Memuat Dashboard Data & Pengaturan...</div>;
  }

  if (error || !summary) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
        <p>{error || 'Data tidak tersedia'}</p>
        <button onClick={loadData} className="btn btn-primary" style={{ marginTop: '10px' }}>Coba Lagi</button>
      </div>
    );
  }

  const { employees, branches, late_rules } = summary;

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="view-title">Pusat Data & Pengaturan</h1>
          <p className="view-subtitle">Dashboard manajemen terpadu untuk Data Karyawan, Cabang Outlet, dan Pengaturan Sistem</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowBranchModal(true)}
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
            🏢 + Cabang Baru
          </button>
          <button
            onClick={() => setView('employees')}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            👤 Kelola Karyawan
          </button>
        </div>
      </div>

      {/* Pending Candidate Promotion Banner */}
      {employees.pending_promotion > 0 && (
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
              <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '14px' }}>
                Ada {employees.pending_promotion} Kandidat Lulus Seleksi (Hired)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Kandidat yang telah menerima offering letter siap dipromosikan ke tabel Karyawan Aktif.
              </div>
            </div>
          </div>
          <button
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

      {/* Top 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {/* Karyawan Card */}
        <div
          className="card"
          onClick={() => setActiveTab('employees')}
          style={{ padding: '18px', cursor: 'pointer', borderLeft: '4px solid #10b981', transition: 'transform 0.15s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Karyawan Aktif</span>
            <span style={{ fontSize: '18px' }}>👥</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', marginBottom: '6px' }}>
            {employees.total} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>orang</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '10px' }}>
            <span>Frontliner: <strong>{employees.frontliner}</strong></span>
            <span>•</span>
            <span>Staff: <strong>{employees.staff}</strong></span>
          </div>
        </div>

        {/* Cabang Card */}
        <div
          className="card"
          onClick={() => setActiveTab('branches')}
          style={{ padding: '18px', cursor: 'pointer', borderLeft: '4px solid #3b82f6', transition: 'transform 0.15s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cabang Outlet</span>
            <span style={{ fontSize: '18px' }}>🏢</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#3b82f6', marginBottom: '6px' }}>
            {branches.total} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>lokasi</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
            <span>Konter: <strong>{branches.konter}</strong></span>
            <span>•</span>
            <span>Gudang: <strong>{branches.gudang}</strong></span>
            <span>•</span>
            <span>Petshop: <strong>{branches.petshop}</strong></span>
          </div>
        </div>

        {/* Total Sewa Card */}
        <div
          className="card"
          onClick={() => setActiveTab('branches')}
          style={{ padding: '18px', cursor: 'pointer', borderLeft: '4px solid #f59e0b', transition: 'transform 0.15s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Beban Sewa Outlet</span>
            <span style={{ fontSize: '18px' }}>💰</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#f59e0b', marginBottom: '6px' }}>
            {fmtRp(branches.total_rent)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Estimasi total per bulan
          </div>
        </div>

        {/* Pengaturan Card */}
        <div
          className="card"
          onClick={() => setActiveTab('settings')}
          style={{ padding: '18px', cursor: 'pointer', borderLeft: '4px solid #8b5cf6', transition: 'transform 0.15s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Periode & Denda</span>
            <span style={{ fontSize: '18px' }}>⚙️</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6', marginBottom: '6px' }}>
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
          { id: 'employees', label: `👥 Data Karyawan (${employees.total})` },
          { id: 'branches', label: `🏢 Cabang Outlet (${branches.total})` },
          { id: 'settings', label: '⚙️ Pengaturan & Denda ASBEN' },
        ].map(tab => (
          <button
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
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW TERPADU */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          
          {/* Alokasi Staf per Cabang */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
                🏢 Alokasi Staf per Cabang
              </h3>
              <button
                onClick={() => setView('branches')}
                style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Lihat Semua ➔
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {branches.list.slice(0, 6).map(b => (
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
                      background: b.staff_count > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: b.staff_count > 0 ? '#10b981' : '#ef4444',
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
              <button
                onClick={() => setView('employees')}
                style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Data Lengkap ➔
              </button>
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
                      background: e.employee_type === 'Frontliner' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
                      color: e.employee_type === 'Frontliner' ? '#3b82f6' : '#8b5cf6',
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
                Total {employees.total} karyawan aktif terdaftar di sistem
              </p>
            </div>
            <button
              onClick={() => setView('employees')}
              className="btn btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px' }}
            >
              👤 Buka Form & Tabel Karyawan Penuh ➔
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>TIPE KARYAWAN</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Frontliner (Konter):</span>
                <strong>{employees.frontliner} orang</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Staff & Gudang:</span>
                <strong>{employees.staff} orang</strong>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>STATUS KONTRAK</div>
              {employees.contracts && employees.contracts.map(c => (
                <div key={c.contract_type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{c.contract_type || 'Belum Ditentukan'}:</span>
                  <strong>{c.count} orang</strong>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>STATUS NON-AKTIF</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Resign:</span>
                <strong style={{ color: '#f59e0b' }}>{employees.resign} orang</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Terminated:</span>
                <strong style={{ color: '#ef4444' }}>{employees.terminated} orang</strong>
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowBranchModal(true)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                + Tambah Cabang
              </button>
              <button
                onClick={() => setView('branches')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Buka Manajemen Cabang Penuh ➔
              </button>
            </div>
          </div>

          {/* Branches Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {branches.list.map(b => (
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
                      background: 'rgba(59,130,246,0.15)',
                      color: '#3b82f6',
                      fontFamily: 'monospace'
                    }}>
                      {b.code}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: b.location_type === 'Gudang' ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.15)',
                      color: b.location_type === 'Gudang' ? '#a78bfa' : '#06b6d4'
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
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{fmtRp(b.rent_amount)}</div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: b.staff_count > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: b.staff_count > 0 ? '#10b981' : '#ef4444',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          
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
                background: settingsMsg.type === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: settingsMsg.type === 'ok' ? '#10b981' : '#ef4444',
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
                  value={settingsForm.payroll_period_start_day}
                  onChange={e => setSettingsForm(p => ({ ...p, payroll_period_start_day: parseInt(e.target.value, 10) }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
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
                  value={settingsForm.payroll_period_end_day}
                  onChange={e => setSettingsForm(p => ({ ...p, payroll_period_end_day: parseInt(e.target.value, 10) }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
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
                  value={settingsForm.working_days_per_month}
                  onChange={e => setSettingsForm(p => ({ ...p, working_days_per_month: parseInt(e.target.value, 10) }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: savingSettings ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  marginTop: '6px'
                }}
              >
                {savingSettings ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
              </button>
            </form>
          </div>

          {/* Late Penalty Rules (ASBEN) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ⚠️ Aturan Denda ASBEN
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Denda otomatis keterlambatan jam masuk kerja
                </p>
              </div>
              <button
                onClick={() => setShowRuleModal(true)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Tambah Aturan
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Kejadian Ke-</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Denda per Kejadian</th>
                  </tr>
                </thead>
                <tbody>
                  {late_rules && late_rules.length > 0 ? (
                    late_rules.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          Terlambat ke-<strong>{r.min_count}</strong> s/d <strong>{r.max_count !== null ? r.max_count : '∞'}</strong>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: r.penalty_per_occurrence === 0 ? '#10b981' : '#ef4444' }}>
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

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => setView('settings')}
                style={{ background: 'transparent', border: 'none', color: '#8b5cf6', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Kelola Aturan Selengkapnya di Settings ➔
              </button>
            </div>
          </div>

        </div>
      )}

      {/* QUICK MODAL: TAMBAH CABANG */}
      {showBranchModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '440px',
            background: 'var(--bg-card, #1e1e2d)',
            borderRadius: '16px', border: '1px solid var(--border-color)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Tambah Cabang Baru</h3>
              <button onClick={() => setShowBranchModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleCreateBranch} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {branchMsg && <div style={{ color: '#ef4444', fontSize: '12px' }}>{branchMsg}</div>}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>KODE CABANG *</label>
                <input
                  type="text"
                  placeholder="JKT-01"
                  value={branchForm.code}
                  onChange={e => setBranchForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
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
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>TIPE LOKASI</label>
                  <select
                    value={branchForm.location_type}
                    onChange={e => setBranchForm(p => ({ ...p, location_type: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="Konter">Konter</option>
                    <option value="Gudang">Gudang</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>KOTA</label>
                  <input
                    type="text"
                    placeholder="Jakarta"
                    value={branchForm.city}
                    onChange={e => setBranchForm(p => ({ ...p, city: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>BIAYA SEWA BULANAN (RP)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={branchForm.rent_amount}
                  onChange={e => setBranchForm(p => ({ ...p, rent_amount: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="petshop_chk"
                  checked={branchForm.has_petshop}
                  onChange={e => setBranchForm(p => ({ ...p, has_petshop: e.target.checked }))}
                />
                <label htmlFor="petshop_chk" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Lokasi memiliki unit <strong>Petshop</strong>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBranch}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: savingBranch ? 'not-allowed' : 'pointer' }}
                >
                  {savingBranch ? 'Menyimpan...' : 'Simpan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL: TAMBAH ATURAN DENDA */}
      {showRuleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '100%', maxWidth: '400px',
            background: 'var(--bg-card, #1e1e2d)',
            borderRadius: '16px', border: '1px solid var(--border-color)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Tambah Aturan Denda ASBEN</h3>
              <button onClick={() => setShowRuleModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleCreateRule} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {ruleMsg && <div style={{ color: '#ef4444', fontSize: '12px' }}>{ruleMsg}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>DARI KE- *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={ruleForm.min_count}
                    onChange={e => setRuleForm(p => ({ ...p, min_count: e.target.value }))}
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
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
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
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
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: savingRule ? 'not-allowed' : 'pointer' }}
                >
                  {savingRule ? 'Menyimpan...' : 'Simpan Aturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
