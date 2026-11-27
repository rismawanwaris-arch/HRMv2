import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { settingsApi, adminApi, mobileSessionApi } from '../services/api';

function CopyIconSwap({ isCopied }) {
  return (
    <span className="icon-swap-grid" style={{ marginRight: '6px' }}>
      <span className={`icon-swap-layer ${isCopied ? 'is-shown' : 'is-hidden'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className={`icon-swap-layer ${!isCopied ? 'is-shown' : 'is-hidden'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </span>
    </span>
  );
}

const fmt = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

const ROLE_COLORS = {
  master:  { bg: 'rgba(124,58,237,0.14)', color: 'var(--color-primary)', border: 'rgba(124,58,237,0.35)' },
  finance: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'rgba(16,185,129,0.35)' },
  staff:   { bg: 'var(--color-info-bg)', color: 'var(--color-info)', border: 'rgba(59,130,246,0.35)' },
};

export default function Settings({ currentRole = 'master' }) {
  const [settings, setSettings] = useState({
    payroll_period_start_day: 29,
    payroll_period_end_day: 28,
    working_days_per_month: 25,
    shift_pagi_cutoff: '06:30',
    shift_siang_cutoff: '14:30',
    bpjs_payroll_enabled: '0',
    pph21_payroll_enabled: '0',
    bpjs_kes_emp_rate: '1',
    bpjs_kes_company_rate: '4',
    bpjs_kes_cap: '12000000',
    bpjs_jht_emp_rate: '2',
    bpjs_jht_company_rate: '3.7',
    bpjs_jp_emp_rate: '1',
    bpjs_jp_company_rate: '2',
    bpjs_jp_cap: '10547400',
    bpjs_jkk_rate: '0.24',
    bpjs_jkm_rate: '0.3',
    contract_reminder_days: '30',
    annual_leave_quota: '12',
    overtime_hourly_divisor: '173',
  });
  const [rules, setRules] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [savingShift, setSavingShift] = useState(false);
  const [shiftMsg, setShiftMsg] = useState(null);
  const [savingSunfish, setSavingSunfish] = useState(false);
  const [sunfishMsg, setSunfishMsg] = useState(null);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ min_count: '', max_count: '', penalty_per_occurrence: '' });
  const [ruleMsg, setRuleMsg] = useState(null);
  const [savingRule, setSavingRule] = useState(false);

  // Admin management state (master only)
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminsError, setAdminsError] = useState('');
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: '', password: '', role: 'staff' });
  const [adminMsg, setAdminMsg] = useState(null);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Mobile API connection state
  const [mobileConfig, setMobileConfig] = useState(null);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [savingMobileUrl, setSavingMobileUrl] = useState(false);
  const [mobileUrlMsg, setMobileUrlMsg] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [testingMobileApi, setTestingMobileApi] = useState(false);
  const [mobileTestResult, setMobileTestResult] = useState(null);
  const [showDartSnippet, setShowDartSnippet] = useState(false);
  const copyTimerRef = useRef(null);

  // Mobile session policy & active mobile sessions state
  const [sessionPolicy, setSessionPolicy] = useState({
    token_ttl_hours: 12,
    idle_timeout_minutes: 30,
    app_lock_minutes: 5,
    offline_cache_ttl_hours: 24,
    require_app_lock: true,
    wipe_cache_on_logout: true,
    allow_offline_read: true,
    single_device_mode: false,
  });
  const [savingSessionPolicy, setSavingSessionPolicy] = useState(false);
  const [sessionPolicyMsg, setSessionPolicyMsg] = useState(null);
  const [mobileSessions, setMobileSessions] = useState([]);
  const [loadingMobileSessions, setLoadingMobileSessions] = useState(false);
  const [mobileSessionsMsg, setMobileSessionsMsg] = useState(null);
  const [revokingSessionId, setRevokingSessionId] = useState(null);
  const [revokingAllSessions, setRevokingAllSessions] = useState(false);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    if (!showRuleModal) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !savingRule) setShowRuleModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showRuleModal, savingRule]);

  const loadAdmins = useCallback(() => {
    setLoadingAdmins(true);
    setAdminsError('');
    adminApi.list()
      .then(r => {
        if (r.success) setAdmins(r.data || []);
        else setAdminsError(r.message || 'Gagal memuat daftar admin.');
      })
      .catch(err => setAdminsError(err.message || 'Gagal memuat daftar admin.'))
      .finally(() => setLoadingAdmins(false));
  }, []);

  const loadMobileConfig = useCallback(() => {
    settingsApi.getMobileConfig()
      .then(res => {
        if (res.success && res.data) {
          setMobileConfig(res.data);
          setCustomBaseUrl(res.data.custom_base_url || res.data.recommended_base_url || '');
          if (res.data.session_policy) {
            setSessionPolicy(prev => ({ ...prev, ...res.data.session_policy }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadMobileSessions = useCallback(() => {
    setLoadingMobileSessions(true);
    mobileSessionApi.list()
      .then(res => {
        if (res.success) {
          setMobileSessions(res.data || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMobileSessions(false));
  }, []);

  const loadSettingsData = useCallback(() => {
    setLoadingSettings(true);
    setSettingsError('');
    Promise.all([settingsApi.getSettings(), settingsApi.getPenaltyRules()])
      .then(([s, r]) => {
        if (s.success) setSettings(prev => ({ ...prev, ...s.data }));
        if (r.success) setRules(r.data || []);
      })
      .catch(err => setSettingsError(err.message || 'Gagal memuat pengaturan sistem.'))
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleCopy = async (text, key) => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      alert('Gagal menyalin teks ke clipboard.');
    }
  };

  const handleSaveCustomBaseUrl = async (e) => {
    e.preventDefault();
    setSavingMobileUrl(true);
    setMobileUrlMsg(null);
    try {
      const res = await settingsApi.updateSettings({ mobile_api_base_url: customBaseUrl });
      if (res.success) {
        setMobileUrlMsg({ type: 'ok', text: 'URL API Kustom berhasil disimpan.' });
        loadMobileConfig();
      } else {
        setMobileUrlMsg({ type: 'err', text: res.message || 'Gagal menyimpan URL.' });
      }
    } catch (err) {
      setMobileUrlMsg({ type: 'err', text: err.message || 'Kesalahan jaringan saat menyimpan URL.' });
    } finally {
      setSavingMobileUrl(false);
    }
  };

  const handleTestMobileApi = async () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) {
      setMobileTestResult({
        ok: false,
        latency: 0,
        message: 'Token autentikasi tidak ditemukan. Silakan login ulang.'
      });
      return;
    }

    setTestingMobileApi(true);
    setMobileTestResult(null);
    const start = performance.now();
    try {
      const targetUrl = customBaseUrl || mobileConfig?.recommended_base_url || '/api';
      const cleanUrl = targetUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/mobile/master-data`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });
      const end = performance.now();
      const latency = Math.round(end - start);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setMobileTestResult({
          ok: false,
          latency,
          message: `Server merespon non-JSON (${res.status}). Periksa alamat URL Base API.`
        });
        return;
      }
      const json = await res.json();
      if (res.ok && json.success !== false) {
        setMobileTestResult({
          ok: true,
          latency,
          message: `Koneksi Terenkripsi & Valid (${res.status} OK) · ${json.data?.branches?.length || 0} cabang aktif siap disinkronkan.`
        });
      } else {
        setMobileTestResult({
          ok: false,
          latency,
          message: json.message || `Server merespon status ${res.status}: ${res.statusText}`
        });
      }
    } catch (err) {
      const end = performance.now();
      setMobileTestResult({
        ok: false,
        latency: Math.round(end - start),
        message: `Gagal terhubung: ${err.message}. Pastikan URL dan port dapat diakses.`
      });
    } finally {
      setTestingMobileApi(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
    loadMobileConfig();
    if (currentRole === 'master') {
      loadAdmins();
      loadMobileSessions();
    }
  }, [currentRole, loadSettingsData, loadMobileConfig, loadAdmins, loadMobileSessions]);

  const handleSaveSessionPolicy = async (e) => {
    e.preventDefault();
    setSavingSessionPolicy(true);
    setSessionPolicyMsg(null);
    try {
      const res = await settingsApi.updateSettings({
        mobile_token_ttl_hours: parseInt(sessionPolicy.token_ttl_hours, 10),
        mobile_idle_timeout_minutes: parseInt(sessionPolicy.idle_timeout_minutes, 10),
        mobile_app_lock_minutes: parseInt(sessionPolicy.app_lock_minutes, 10),
        mobile_offline_cache_ttl_hours: parseInt(sessionPolicy.offline_cache_ttl_hours, 10),
        mobile_require_app_lock: sessionPolicy.require_app_lock,
        mobile_wipe_cache_on_logout: sessionPolicy.wipe_cache_on_logout,
        mobile_allow_offline_read: sessionPolicy.allow_offline_read,
        mobile_single_device_mode: sessionPolicy.single_device_mode,
      });
      if (res.success) {
        setSessionPolicyMsg({ type: 'ok', text: 'Kebijakan sesi mobile berhasil disimpan dan langsung berlaku ke aplikasi Flutter.' });
        loadMobileConfig();
        loadMobileSessions();
      } else {
        setSessionPolicyMsg({ type: 'err', text: res.message || 'Gagal menyimpan kebijakan sesi mobile.' });
      }
    } catch (err) {
      setSessionPolicyMsg({ type: 'err', text: err.message || 'Gagal menyimpan kebijakan sesi mobile.' });
    } finally {
      setSavingSessionPolicy(false);
    }
  };

  const handleRevokeOneMobileSession = async (sessionId, username) => {
    if (!window.confirm(`Putus sesi perangkat mobile milik "${username}"? Perangkat akan diminta login ulang dan menghapus cache lokalnya.`)) return;
    setRevokingSessionId(sessionId);
    setMobileSessionsMsg(null);
    try {
      const res = await mobileSessionApi.revokeOne(sessionId);
      if (res.success) {
        setMobileSessionsMsg({ type: 'ok', text: res.message || 'Sesi perangkat mobile berhasil diputus.' });
        loadMobileSessions();
        loadMobileConfig();
      } else {
        setMobileSessionsMsg({ type: 'err', text: res.message || 'Gagal memutus sesi.' });
      }
    } catch (err) {
      setMobileSessionsMsg({ type: 'err', text: err.message || 'Gagal memutus sesi.' });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllMobileSessions = async () => {
    if (!window.confirm('Putus SEMUA sesi aplikasi mobile yang sedang aktif? Seluruh perangkat akan diminta login ulang.')) return;
    setRevokingAllSessions(true);
    setMobileSessionsMsg(null);
    try {
      const res = await mobileSessionApi.revokeAll();
      if (res.success) {
        setMobileSessionsMsg({ type: 'ok', text: res.message || 'Semua sesi mobile berhasil diputus.' });
        loadMobileSessions();
        loadMobileConfig();
      } else {
        setMobileSessionsMsg({ type: 'err', text: res.message || 'Gagal memutus semua sesi.' });
      }
    } catch (err) {
      setMobileSessionsMsg({ type: 'err', text: err.message || 'Gagal memutus semua sesi.' });
    } finally {
      setRevokingAllSessions(false);
    }
  };

  const handleRevokeAdminSessions = async (id, username) => {
    if (!window.confirm(`Cabut seluruh sesi aktif (Web & Mobile) milik akun "${username}"?`)) return;
    try {
      const res = await adminApi.revokeSessions(id);
      if (res.success) {
        setAdminMsg({ type: 'ok', text: `Sesi aktif "${username}" berhasil dicabut.` });
        loadMobileSessions();
        loadMobileConfig();
      } else {
        alert(res.message || 'Gagal mencabut sesi.');
      }
    } catch (err) {
      alert(err.message || 'Gagal mencabut sesi.');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setSavingAdmin(true); setAdminMsg(null);
    try {
      const res = await adminApi.create(adminForm);
      if (res.success) {
        setAdminMsg({ type: 'ok', text: res.message });
        setAdminForm({ username: '', password: '', role: 'staff' });
        setShowAdminForm(false);
        loadAdmins();
      } else {
        setAdminMsg({ type: 'err', text: res.message || 'Gagal menambah admin.' });
      }
    } catch (err) {
      setAdminMsg({ type: 'err', text: err.message || 'Gagal menambah admin.' });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id, username) => {
    if (!window.confirm(`Hapus akun "${username}"?`)) return;
    try {
      const res = await adminApi.delete(id);
      if (res.success) loadAdmins();
      else alert(res.message || 'Gagal menghapus.');
    } catch (err) {
      alert(err.message || 'Gagal menghapus.');
    }
  };

  const handleChangeAdminRole = async (id, role) => {
    try {
      await adminApi.updateRole(id, role);
      loadAdmins();
    } catch (err) {
      alert(err.message || 'Gagal mengubah role.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await settingsApi.updateSettings({
        payroll_period_start_day: settings.payroll_period_start_day,
        payroll_period_end_day: settings.payroll_period_end_day,
        working_days_per_month: settings.working_days_per_month,
      });
      setSettingsMsg({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    setSavingShift(true);
    setShiftMsg(null);
    try {
      const res = await settingsApi.updateSettings({
        shift_pagi_cutoff: settings.shift_pagi_cutoff,
        shift_siang_cutoff: settings.shift_siang_cutoff,
      });
      setShiftMsg({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err) {
      setShiftMsg({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan.' });
    } finally {
      setSavingShift(false);
    }
  };

  const handleSaveSunfish = async (e) => {
    e.preventDefault();
    setSavingSunfish(true);
    setSunfishMsg(null);
    try {
      const res = await settingsApi.updateSettings({
        bpjs_payroll_enabled: settings.bpjs_payroll_enabled === '1' ? '1' : '0',
        pph21_payroll_enabled: settings.pph21_payroll_enabled === '1' ? '1' : '0',
        bpjs_kes_emp_rate: settings.bpjs_kes_emp_rate,
        bpjs_kes_company_rate: settings.bpjs_kes_company_rate,
        bpjs_kes_cap: settings.bpjs_kes_cap,
        bpjs_jht_emp_rate: settings.bpjs_jht_emp_rate,
        bpjs_jht_company_rate: settings.bpjs_jht_company_rate,
        bpjs_jp_emp_rate: settings.bpjs_jp_emp_rate,
        bpjs_jp_company_rate: settings.bpjs_jp_company_rate,
        bpjs_jp_cap: settings.bpjs_jp_cap,
        bpjs_jkk_rate: settings.bpjs_jkk_rate,
        bpjs_jkm_rate: settings.bpjs_jkm_rate,
        contract_reminder_days: settings.contract_reminder_days,
        annual_leave_quota: settings.annual_leave_quota,
        overtime_hourly_divisor: settings.overtime_hourly_divisor,
      });
      setSunfishMsg({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err) {
      setSunfishMsg({ type: 'error', text: err.message || 'Gagal menyimpan konfigurasi.' });
    } finally {
      setSavingSunfish(false);
    }
  };

  const openAddRule = () => {
    setEditingRule(null);
    setRuleForm({ min_count: '', max_count: '', penalty_per_occurrence: '' });
    setRuleMsg(null);
    setShowRuleModal(true);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      min_count: rule.min_count,
      max_count: rule.max_count ?? '',
      penalty_per_occurrence: rule.penalty_per_occurrence,
    });
    setRuleMsg(null);
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    const minCount = parseInt(ruleForm.min_count, 10);
    const maxCount = ruleForm.max_count !== '' ? parseInt(ruleForm.max_count, 10) : null;
    if (Number.isNaN(minCount) || minCount < 1) {
      setRuleMsg({ type: 'error', text: 'Keterlambatan ke- harus bernilai minimal 1.' });
      return;
    }
    if (maxCount !== null && (Number.isNaN(maxCount) || maxCount < minCount)) {
      setRuleMsg({ type: 'error', text: 'Batas "Sampai ke-" harus lebih besar atau sama dengan "Keterlambatan ke-".' });
      return;
    }

    setSavingRule(true);
    setRuleMsg(null);
    try {
      const payload = {
        min_count: minCount,
        max_count: maxCount,
        penalty_per_occurrence: parseInt(ruleForm.penalty_per_occurrence, 10) || 0,
      };
      let res;
      if (editingRule) {
        res = await settingsApi.updatePenaltyRule(editingRule.id, payload);
        if (res.success) setRules(prev => prev.map(r => r.id === editingRule.id ? res.data : r));
      } else {
        res = await settingsApi.createPenaltyRule(payload);
        if (res.success) setRules(prev => [...prev, res.data].sort((a, b) => a.min_count - b.min_count));
      }
      if (res.success) setShowRuleModal(false);
      else setRuleMsg({ type: 'error', text: res.message || 'Gagal menyimpan aturan.' });
    } catch (err) {
      setRuleMsg({ type: 'error', text: err.message || 'Gagal menyimpan aturan.' });
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Hapus aturan keterlambatan ke-${rule.min_count}?`)) return;
    try {
      await settingsApi.deletePenaltyRule(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
    } catch (err) {
      alert(err.message || 'Gagal menghapus aturan.');
    }
  };

  const effectiveBaseUrl = customBaseUrl || mobileConfig?.recommended_base_url || 'http://100.103.255.45:5002/api';
  const dartSnippet = [
    'class ApiConfig {',
    '  // Base URL tunggal: akhiri dengan /api (TANPA trailing slash)',
    `  static const String defaultBaseUrl = '${effectiveBaseUrl}';`,
    '',
    '  // Koneksi & Auth',
    "  static const String health = '/mobile/health';",
    "  static const String login = '/mobile/login';",
    "  static const String logout = '/mobile/logout';",
    "  static const String sessionRefresh = '/mobile/session/refresh';",
    "  static const String me = '/mobile/me';",
    "  static const String masterData = '/mobile/master-data';",
    "  static const String assets = '/mobile/assets';",
    "  static const String employees = '/mobile/employees';",
    '',
    '  // Offline Sync (Idempotent via client_uuid)',
    "  static const String syncAsset = '/mobile/sync/asset';",
    "  static const String syncVisit = '/mobile/sync/visit';",
    "  static const String syncIncident = '/mobile/sync/incident';",
    "  static const String syncEmployee = '/mobile/sync/employee';",
    '',
    '  // HR & SunFish Mobile Modules',
    "  static const String attendanceCheckin = '/mobile/attendance/checkin';",
    "  static const String attendanceToday = '/mobile/attendance/today';",
    "  static const String attendanceHistory = '/mobile/attendance/history';",
    "  static const String leaveTypes = '/mobile/leaves/types';",
    "  static const String leaveBalances = '/mobile/leaves/balances';",
    "  static const String leaveRequests = '/mobile/leaves/requests';",
    "  static const String overtime = '/mobile/overtime';",
    "  static const String reimbursements = '/mobile/reimbursements';",
    '}',
  ].join('\n');

  const inputStyle = {
    background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px',
    width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  };

  if (loadingSettings) return (
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
      <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
      Memuat pengaturan...
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan Sistem</h1>
          <p className="page-subtitle">Konfigurasi periode penggajian dan aturan denda keterlambatan.</p>
        </div>
      </div>

      {settingsError && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '20px', border: '1px solid rgba(239,68,68,0.35)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>⚠ {settingsError}</span>
          <button type="button" onClick={loadSettingsData} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>Coba Lagi</button>
        </div>
      )}

      {/* Payroll Period Settings */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Pengaturan Periode Penggajian</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Tentukan tanggal mulai/akhir periode dan hari kerja standar per bulan.
          </p>
        </div>
        <form onSubmit={handleSaveSettings} style={{ padding: '24px' }}>
          <div className="responsive-grid-3" style={{ gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Tanggal Mulai Periode
              </label>
              <input
                type="number" min="1" max="31" style={inputStyle}
                value={settings.payroll_period_start_day}
                onChange={e => setSettings(p => ({ ...p, payroll_period_start_day: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Contoh: 29 → mulai tgl 29</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Tanggal Akhir Periode
              </label>
              <input
                type="number" min="1" max="31" style={inputStyle}
                value={settings.payroll_period_end_day}
                onChange={e => setSettings(p => ({ ...p, payroll_period_end_day: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Contoh: 28 → berakhir tgl 28</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Hari Kerja Standar / Bulan
              </label>
              <input
                type="number" min="1" max="31" style={inputStyle}
                value={settings.working_days_per_month}
                onChange={e => setSettings(p => ({ ...p, working_days_per_month: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Untuk hitung potongan absen per hari</p>
            </div>
          </div>

          {settingsMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
              background: settingsMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: settingsMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              border: `1px solid ${settingsMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {settingsMsg.text}
            </div>
          )}

          <button
            type="submit" disabled={savingSettings}
            style={{
              padding: '10px 24px', background: savingSettings ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none', borderRadius: '10px', color: 'white', cursor: savingSettings ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      </div>

      {/* Attendance Shift Settings */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Pengaturan Batas Jam Masuk Shift</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Karyawan yang masuk setelah batas waktu ini dihitung <strong>Telat</strong> dan dikenakan ASBEN.
          </p>
        </div>
        <form onSubmit={handleSaveShift} style={{ padding: '24px' }}>
          <div className="responsive-grid-2" style={{ gap: '20px', marginBottom: '20px', maxWidth: '480px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Batas Shift Pagi
              </label>
              <input
                type="time"
                style={inputStyle}
                value={settings.shift_pagi_cutoff || '06:30'}
                onChange={e => setSettings(p => ({ ...p, shift_pagi_cutoff: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Masuk setelah jam ini → Telat
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Batas Shift Siang
              </label>
              <input
                type="time"
                style={inputStyle}
                value={settings.shift_siang_cutoff || '14:30'}
                onChange={e => setSettings(p => ({ ...p, shift_siang_cutoff: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Masuk setelah jam ini → Telat
              </p>
            </div>
          </div>

          {/* Contoh perhitungan */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {[
              { label: 'Shift Pagi tepat waktu', time: `≤ ${settings.shift_pagi_cutoff || '06:30'}`, color: '#10b981' },
              { label: 'Shift Pagi telat', time: `> ${settings.shift_pagi_cutoff || '06:30'}`, color: '#f59e0b' },
              { label: 'Shift Siang tepat waktu', time: `≤ ${settings.shift_siang_cutoff || '14:30'}`, color: '#10b981' },
              { label: 'Shift Siang telat', time: `> ${settings.shift_siang_cutoff || '14:30'}`, color: '#f59e0b' },
            ].map(c => (
              <div key={c.label} style={{
                padding: '8px 14px', borderRadius: '10px',
                background: `${c.color}12`, border: `1px solid ${c.color}30`,
                fontSize: '12px',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{c.label}: </span>
                <span style={{ color: c.color, fontWeight: 700 }}>{c.time}</span>
              </div>
            ))}
          </div>

          {shiftMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
              background: shiftMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: shiftMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              border: `1px solid ${shiftMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {shiftMsg.text}
            </div>
          )}

          <button
            type="submit" disabled={savingShift}
            style={{
              padding: '10px 24px', background: savingShift ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none', borderRadius: '10px', color: 'white', cursor: savingShift ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {savingShift ? 'Menyimpan...' : 'Simpan Batas Shift'}
          </button>
        </form>
      </div>

      {/* SunFish HR Statutory, Contract & Leave Settings */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Konfigurasi BPJS, PPh 21 TER, Kontrak &amp; Cuti
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Aktifkan kalkulasi otomatis BPJS &amp; PPh 21 TER pada Payroll serta parameter reminder kontrak dan kuota cuti.
          </p>
        </div>
        <form onSubmit={handleSaveSunfish} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={settings.bpjs_payroll_enabled === '1'}
                onChange={e => setSettings(p => ({ ...p, bpjs_payroll_enabled: e.target.checked ? '1' : '0' }))}
              />
              Aktifkan Potongan BPJS Otomatis di Payroll
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={settings.pph21_payroll_enabled === '1'}
                onChange={e => setSettings(p => ({ ...p, pph21_payroll_enabled: e.target.checked ? '1' : '0' }))}
              />
              Aktifkan PPh 21 TER (PP 58/2023) di Payroll
            </label>
          </div>

          <div className="responsive-grid-3" style={{ gap: '16px', marginBottom: '18px' }}>
            {[
              ['bpjs_kes_emp_rate', 'BPJS Kes Karyawan (%)', '0.1'],
              ['bpjs_kes_company_rate', 'BPJS Kes Perusahaan (%)', '0.1'],
              ['bpjs_kes_cap', 'Batas Upah BPJS Kes (Rp)', '100000'],
              ['bpjs_jht_emp_rate', 'JHT Karyawan (%)', '0.1'],
              ['bpjs_jht_company_rate', 'JHT Perusahaan (%)', '0.1'],
              ['bpjs_jp_emp_rate', 'JP Karyawan (%)', '0.1'],
              ['bpjs_jp_company_rate', 'JP Perusahaan (%)', '0.1'],
              ['bpjs_jp_cap', 'Batas Upah JP (Rp)', '100000'],
              ['bpjs_jkk_rate', 'Tarif JKK Perusahaan (%)', '0.01'],
              ['bpjs_jkm_rate', 'Tarif JKM Perusahaan (%)', '0.01'],
              ['contract_reminder_days', 'Reminder Kontrak (Hari)', '1'],
              ['annual_leave_quota', 'Kuota Cuti Tahunan (Hari)', '1'],
              ['overtime_hourly_divisor', 'Pembagi Jam Lembur (173)', '1'],
            ].map(([key, label, step]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  step={step}
                  style={inputStyle}
                  value={settings[key] ?? ''}
                  onChange={e => setSettings(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {sunfishMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px',
              background: sunfishMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: sunfishMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {sunfishMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingSunfish}
            className="btn btn-primary"
          >
            {savingSunfish ? 'Menyimpan...' : 'Simpan Konfigurasi BPJS & HR'}
          </button>
        </form>
      </div>

      {/* Late Penalty Rules */}
      <div className="glass-panel">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Aturan Denda Keterlambatan (ASBEN)</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Denda per kejadian berdasarkan jumlah keterlambatan karyawan dalam satu periode.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openAddRule}
          >
            + Tambah Aturan
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {rules.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>Belum ada aturan denda.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Keterlambatan ke-</th>
                    <th>Sampai ke-</th>
                    <th>Denda per Kejadian</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rule.min_count}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{rule.max_count ?? '∞ (tak terbatas)'}</td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          color: rule.penalty_per_occurrence > 0 ? 'var(--color-warning)' : 'var(--text-muted)',
                        }}>
                          {rule.penalty_per_occurrence > 0 ? `Rp ${fmt(rule.penalty_per_occurrence)}` : 'Tidak didenda'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => openEditRule(rule)}
                          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginRight: '8px' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule)}
                          style={{ background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--color-danger)', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(139,92,246,0.08)', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.2)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--color-primary)' }}>Cara kerja:</strong> Sistem akan menghitung denda berdasarkan jumlah keterlambatan karyawan dalam satu periode penggajian.
              Denda masuk sebagai potongan gaji karyawan sekaligus sebagai Pendapatan ASBEN di laporan keuangan cabang.
            </p>
          </div>
        </div>
      </div>

      {/* Rule Modal */}
      {showRuleModal && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(6px)', padding: '16px', overscrollBehavior: 'contain' }}
          onClick={() => !savingRule && setShowRuleModal(false)}
        >
          <div
            style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingRule ? 'Edit Aturan Denda' : 'Tambah Aturan Denda'}
              </h3>
              <button type="button" disabled={savingRule} onClick={() => setShowRuleModal(false)} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: savingRule ? 'not-allowed' : 'pointer', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <form onSubmit={handleSaveRule} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ruleMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {ruleMsg.text}
                </div>
              )}
              <div className="responsive-grid-2" style={{ gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Keterlambatan ke- (dari) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input type="number" min="1" style={inputStyle} required
                    value={ruleForm.min_count}
                    onChange={e => setRuleForm(p => ({ ...p, min_count: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Sampai ke- (kosong = ∞)
                  </label>
                  <input type="number" min="1" style={inputStyle}
                    placeholder="Tak terbatas"
                    value={ruleForm.max_count}
                    onChange={e => setRuleForm(p => ({ ...p, max_count: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Denda per Kejadian (Rp)
                </label>
                <input type="number" min="0" step="1000" style={inputStyle}
                  placeholder="0 = tidak didenda"
                  value={ruleForm.penalty_per_occurrence}
                  onChange={e => setRuleForm(p => ({ ...p, penalty_per_occurrence: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button type="button" disabled={savingRule} onClick={() => setShowRuleModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', cursor: savingRule ? 'not-allowed' : 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '14px' }}>
                  Batal
                </button>
                <button type="submit" disabled={savingRule}
                  style={{ flex: 2, padding: '12px', background: savingRule ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '10px', color: 'white', cursor: savingRule ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px' }}>
                  {savingRule ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── PENGATURAN API MOBILE & FLUTTER ── */}
      <div className="card" style={{ marginTop: '24px', position: 'relative', overflow: 'hidden' }}>
        {/* Top Accent Gradient Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #4f46e5, #9333ea, #10b981)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(147,51,234,0.2))',
              border: '1px solid rgba(99,102,241,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 18px rgba(79,70,229,0.2)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Pusat Koneksi & Keamanan API Mobile (Flutter Android)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Manajemen endpoint sinkronisasi offline-first, proteksi PII terenkripsi, dan pemantauan transmisi tim lapangan HRGA
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '20px',
              background: 'rgba(139,92,246,0.12)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(139,92,246,0.28)',
              fontSize: '11.5px',
              fontWeight: 600
            }}>
              🛡️ AES-256-GCM & RBAC Aktif
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: '20px',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              border: '1px solid rgba(16,185,129,0.28)',
              fontSize: '12px',
              fontWeight: 700
            }}>
              <span className="live-pulse-dot" />
              API Online (Port {mobileConfig?.port || 5002})
            </span>
          </div>
        </div>

        {/* Statistik Sinkronisasi Mobile */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
          gap: '12px',
          marginBottom: '22px'
        }}>
          <div className="sync-metric-card" style={{ borderTop: '2px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>ASET TERSINKRON</span>
              <span style={{ fontSize: '15px' }}>📦</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
              {mobileConfig?.sync_stats?.synced_assets ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Unit dari aplikasi mobile</div>
          </div>

          <div className="sync-metric-card" style={{ borderTop: '2px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>KUNJUNGAN GA</span>
              <span style={{ fontSize: '15px' }}>📋</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-success)', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
              {mobileConfig?.sync_stats?.synced_visits ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Laporan audit cabang</div>
          </div>

          <div className="sync-metric-card" style={{ borderTop: '2px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>INSIDEN OUTLET</span>
              <span style={{ fontSize: '15px' }}>⚠️</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-warning)', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
              {mobileConfig?.sync_stats?.synced_incidents ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Temuan darurat lapangan</div>
          </div>

          <div className="sync-metric-card" style={{ borderTop: '2px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>KARYAWAN BARU</span>
              <span style={{ fontSize: '15px' }}>👤</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
              {mobileConfig?.sync_stats?.synced_employees ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>PII terenkripsi di server</div>
          </div>
        </div>

        {/* Opsi Alamat Koneksi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          {/* 1. HP Fisik Android */}
          <div className="api-conn-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  1. HP Fisik Android (Wi-Fi Lokal / Jaringan Kantor)
                </span>
                <span style={{ fontSize: '11px', background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  Otomatis Terdeteksi
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Gunakan URL ini di Flutter saat HP Android terhubung pada jaringan Wi-Fi yang sama dengan server.
              </div>
              <code style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: 'var(--color-success)', fontWeight: 600, background: 'var(--bg-surface)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {mobileConfig?.recommended_base_url || 'Memuat IP...'}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(mobileConfig?.recommended_base_url || '', 'wifi')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                paddingBlock: '9px',
                paddingInlineStart: '14px',
                paddingInlineEnd: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: copiedKey === 'wifi' ? '#10b981' : 'var(--bg-surface)',
                color: copiedKey === 'wifi' ? '#fff' : 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, scale 150ms ease-out',
              }}
            >
              <CopyIconSwap isCopied={copiedKey === 'wifi'} />
              {copiedKey === 'wifi' ? 'URL Tersalin!' : 'Salin URL'}
            </button>
          </div>

          {/* 2. Android Studio Emulator */}
          <div className="api-conn-card">
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                2. Android Studio Emulator (Development Lokal)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Alamat loopback khusus <code>10.0.2.2</code> untuk menghubungkan emulator ke localhost komputer.
              </div>
              <code style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: 'var(--color-info)', fontWeight: 600, background: 'var(--bg-surface)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {mobileConfig?.emulator_base_url || 'http://10.0.2.2:5002/api'}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(mobileConfig?.emulator_base_url || 'http://10.0.2.2:5002/api', 'emu')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                paddingBlock: '9px',
                paddingInlineStart: '14px',
                paddingInlineEnd: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: copiedKey === 'emu' ? '#10b981' : 'var(--bg-surface)',
                color: copiedKey === 'emu' ? '#fff' : 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, scale 150ms ease-out',
              }}
            >
              <CopyIconSwap isCopied={copiedKey === 'emu'} />
              {copiedKey === 'emu' ? 'URL Tersalin!' : 'Salin URL'}
            </button>
          </div>

          {/* 3. URL Kustom / Tailscale ZimaOS / Domain Produksi */}
          <form onSubmit={handleSaveCustomBaseUrl} className="api-conn-card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                3. Endpoint Tailscale ZimaOS / Domain Produksi
              </div>
              <span style={{ fontSize: '11px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                Rekomendasi ZimaOS Tailscale
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '12px' }}>
              Masukkan IP Tailscale ZimaOS (contoh: <code>http://100.103.255.45:5002/api</code>) atau domain HTTPS publik.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="http://100.103.255.45:5002/api"
                value={customBaseUrl}
                onChange={e => setCustomBaseUrl(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  maxWidth: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(customBaseUrl || '', 'custom')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  paddingBlock: '10px',
                  paddingInlineStart: '12px',
                  paddingInlineEnd: '14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: copiedKey === 'custom' ? '#10b981' : 'var(--bg-surface)',
                  color: copiedKey === 'custom' ? '#fff' : 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, scale 150ms ease-out',
                }}
              >
                <CopyIconSwap isCopied={copiedKey === 'custom'} />
                {copiedKey === 'custom' ? 'Tersalin' : 'Salin'}
              </button>
              <button
                type="submit"
                disabled={savingMobileUrl}
                className="btn-primary"
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: savingMobileUrl ? '#666' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: savingMobileUrl ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {savingMobileUrl ? 'Menyimpan...' : 'Simpan Endpoint'}
              </button>
            </div>
            {mobileUrlMsg && (
              <div style={{ marginTop: '10px', fontSize: '12.5px', fontWeight: 600, color: mobileUrlMsg.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)', animation: 'popIn 0.25s ease forwards' }}>
                {mobileUrlMsg.type === 'ok' ? '✓ ' : '✕ '}{mobileUrlMsg.text}
              </div>
            )}
          </form>
        </div>

        {/* Uji Koneksi & Tombol Lihat Kode Dart */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleTestMobileApi}
              disabled={testingMobileApi}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(16,185,129,0.5)',
                background: testingMobileApi ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.1))',
                color: 'var(--color-success)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: testingMobileApi ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {testingMobileApi ? '⏳ Memverifikasi Enkripsi & Endpoint...' : '⚡ Uji Respon API Mobile'}
            </button>
            <button
              type="button"
              onClick={() => setShowDartSnippet(p => !p)}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: showDartSnippet ? 'rgba(99,102,241,0.15)' : 'var(--bg-hover)',
                color: showDartSnippet ? 'var(--color-primary)' : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {showDartSnippet ? '▲ Sembunyikan Kode Dart' : '💻 Lihat Template ApiConfig.dart'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="/docs/FLUTTER_API_INTEGRATION_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--color-info)', textDecoration: 'none', fontWeight: 700 }}
            >
              📱 Panduan Integrasi API Flutter v2.0 ↗
            </a>
            <a
              href="/docs/ANDROID_SECURITY_AND_SYNC_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--color-success)', textDecoration: 'none', fontWeight: 600 }}
            >
              🛡️ Panduan Keamanan Android ↗
            </a>
            <a
              href="/docs/FLUTTER_HRGA_SPEC.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              📄 Dokumen PRD Spec ↗
            </a>
          </div>
        </div>

        {/* Hasil Uji Respon API */}
        {mobileTestResult && (
          <div style={{
            marginTop: '14px',
            padding: '13px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            background: mobileTestResult.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            border: `1px solid ${mobileTestResult.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            color: mobileTestResult.ok ? 'var(--color-success)' : 'var(--color-danger)',
            animation: 'popIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{mobileTestResult.ok ? '✅' : '❌'}</span>
              <div>
                <strong>{mobileTestResult.ok ? 'Respon Valid: ' : 'Koneksi Gagal: '}</strong>
                {mobileTestResult.message}
              </div>
            </div>
            <div style={{
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: '6px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}>
              ⚡ Latency: {mobileTestResult.latency} ms
            </div>
          </div>
        )}

        {/* Template Kode Dart Flutter */}
        {showDartSnippet && (
          <div style={{
            marginTop: '16px',
            background: 'var(--bg-surface)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            animation: 'submenuExpand 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                lib/core/api_config.dart
              </span>
              <button
                type="button"
                onClick={() => handleCopy(dartSnippet, 'dart')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  background: copiedKey === 'dart' ? '#10b981' : 'var(--bg-hover)',
                  color: copiedKey === 'dart' ? '#fff' : 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {copiedKey === 'dart' ? '✓ Kode Tersalin!' : '📋 Salin Kode Dart'}
              </button>
            </div>
            <pre style={{
              margin: 0,
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#34d399',
              background: '#0d1117',
              padding: '14px',
              borderRadius: '10px',
              overflowX: 'auto',
              lineHeight: '1.55',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              {dartSnippet}
            </pre>
          </div>
        )}

        {/* ── KEBIJAKAN SESI & CACHE OFFLINE MOBILE (master only) ── */}
        {currentRole === 'master' && (
          <div style={{ marginTop: '22px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  🔐 Kebijakan Sesi & Cache Offline Aplikasi Mobile
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Atur batas waktu sesi, idle timeout otomatis di server, kunci layar biometrik/PIN, serta batas cache lokal Flutter.
                </p>
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.28)' }}>
                📱 Sesi Aktif: {mobileConfig?.active_mobile_sessions ?? 0} Perangkat
              </span>
            </div>

            <form onSubmit={handleSaveSessionPolicy} style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Masa Berlaku Token (Jam)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={sessionPolicy.token_ttl_hours}
                    onChange={e => setSessionPolicy(p => ({ ...p, token_ttl_hours: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Default 12 jam (1–168 jam)</div>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Batas Idle Server (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={sessionPolicy.idle_timeout_minutes}
                    onChange={e => setSessionPolicy(p => ({ ...p, idle_timeout_minutes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Auto-logout jika tidak aktif (1–1440 mnt)</div>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Kunci Layar Background (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={sessionPolicy.app_lock_minutes}
                    onChange={e => setSessionPolicy(p => ({ ...p, app_lock_minutes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Minta Biometrik/PIN setelah di-minimize</div>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Batas Cache Offline (Jam)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={sessionPolicy.offline_cache_ttl_hours}
                    onChange={e => setSessionPolicy(p => ({ ...p, offline_cache_ttl_hours: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Kunci cache lokal jika offline melebihi batas</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sessionPolicy.require_app_lock)}
                    onChange={e => setSessionPolicy(p => ({ ...p, require_app_lock: e.target.checked }))}
                  />
                  Wajib kunci aplikasi (Biometrik / PIN)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sessionPolicy.wipe_cache_on_logout)}
                    onChange={e => setSessionPolicy(p => ({ ...p, wipe_cache_on_logout: e.target.checked }))}
                  />
                  Hapus cache lokal otomatis saat logout / 401
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sessionPolicy.allow_offline_read)}
                    onChange={e => setSessionPolicy(p => ({ ...p, allow_offline_read: e.target.checked }))}
                  />
                  Izinkan baca cache sementara saat koneksi lambat
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sessionPolicy.single_device_mode)}
                    onChange={e => setSessionPolicy(p => ({ ...p, single_device_mode: e.target.checked }))}
                  />
                  Mode 1 perangkat per akun (logout perangkat lama)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={savingSessionPolicy}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '9px',
                    border: 'none',
                    background: savingSessionPolicy ? '#666' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: savingSessionPolicy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingSessionPolicy ? 'Menyimpan...' : '💾 Simpan Kebijakan Sesi Mobile'}
                </button>
                {sessionPolicyMsg && (
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: sessionPolicyMsg.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {sessionPolicyMsg.type === 'ok' ? '✓ ' : '✕ '}{sessionPolicyMsg.text}
                  </span>
                )}
              </div>
            </form>

            {/* ── MONITOR & PENCABUTAN SESI MOBILE AKTIF ── */}
            <div style={{ marginTop: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    📡 Sesi Perangkat Mobile Terdaftar
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Pantau perangkat Flutter yang pernah login dan putus akses jarak jauh jika HP hilang atau berpindah tangan.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={loadMobileSessions}
                    disabled={loadingMobileSessions}
                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {loadingMobileSessions ? 'Memuat...' : '🔄 Muat Ulang'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRevokeAllMobileSessions}
                    disabled={revokingAllSessions}
                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '12px', fontWeight: 700, cursor: revokingAllSessions ? 'not-allowed' : 'pointer' }}
                  >
                    {revokingAllSessions ? 'Memutus...' : '🚫 Putus Semua Sesi Mobile'}
                  </button>
                </div>
              </div>

              {mobileSessionsMsg && (
                <div style={{ marginBottom: '10px', fontSize: '12.5px', fontWeight: 600, color: mobileSessionsMsg.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {mobileSessionsMsg.type === 'ok' ? '✓ ' : '✕ '}{mobileSessionsMsg.text}
                </div>
              )}

              {loadingMobileSessions ? (
                <div style={{ textAlign: 'center', padding: '16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>Memuat daftar sesi mobile...</div>
              ) : mobileSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '18px', fontSize: '12.5px', color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px dashed var(--border-color)' }}>
                  Belum ada perangkat mobile yang tercatat login.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {mobileSessions.map(s => {
                    const statusMap = {
                      active: { label: 'Aktif', bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
                      idle_expired: { label: 'Idle Timeout', bg: 'rgba(245,158,11,0.14)', color: 'var(--color-warning)' },
                      expired: { label: 'Kedaluwarsa', bg: 'var(--bg-surface)', color: 'var(--text-muted)' },
                      revoked: { label: `Dicabut (${s.revoked_reason || 'manual'})`, bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
                    };
                    const badge = statusMap[s.status] || statusMap.expired;
                    return (
                      <div key={s.session_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>
                        <div style={{ minWidth: '200px', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{s.username}</strong>
                            <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: badge.bg, color: badge.color, fontWeight: 700 }}>
                              {badge.label}
                            </span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                              {s.device_name || 'Perangkat Mobile'} {s.platform ? `(${s.platform}${s.app_version ? ` v${s.app_version}` : ''})` : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            Aktif terakhir: {s.last_active_at ? new Date(s.last_active_at).toLocaleString('id-ID') : '-'} · IP: {s.ip_address || '-'}
                          </div>
                        </div>
                        {!s.revoked_at && (
                          <button
                            type="button"
                            disabled={revokingSessionId === s.session_id}
                            onClick={() => handleRevokeOneMobileSession(s.session_id, s.username)}
                            style={{ padding: '6px 11px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.35)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            {revokingSessionId === s.session_id ? 'Memutus...' : 'Putus Sesi'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MANAJEMEN ADMIN (master only) ── */}
      {currentRole === 'master' && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Manajemen Admin</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Kelola akun dan peran pengguna admin sistem</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAdminForm(p => !p); setAdminMsg(null); }}
              style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              {showAdminForm ? 'Batal' : '+ Tambah Admin'}
            </button>
          </div>

          {/* Form tambah admin */}
          {showAdminForm && (
            <form onSubmit={handleCreateAdmin} style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Username</label>
                  <input required value={adminForm.username} onChange={e => setAdminForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="username baru"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Password</label>
                  <input required type="password" minLength={8} value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="min. 8 karakter"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Peran</label>
                  <select value={adminForm.role} onChange={e => setAdminForm(p => ({ ...p, role: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}>
                    <option value="staff">Admin Staff</option>
                    <option value="finance">Admin Finance</option>
                    <option value="master">Master</option>
                  </select>
                </div>
                <button type="submit" disabled={savingAdmin}
                  style={{ padding: '8px 16px', background: savingAdmin ? '#666' : '#10b981', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {savingAdmin ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
              {adminMsg && <div style={{ fontSize: '13px', color: adminMsg.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>{adminMsg.text}</div>}
            </form>
          )}

          {/* Daftar admin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingAdmins ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Memuat...</div>
            ) : adminsError ? (
              <div style={{ textAlign: 'center', color: 'var(--color-danger)', fontSize: '13px', padding: '16px' }}>
                ⚠ {adminsError}{' '}
                <button type="button" onClick={loadAdmins} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px', marginLeft: '8px' }}>Coba Lagi</button>
              </div>
            ) : admins.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Belum ada akun admin.</div>
            ) : admins.map(adm => {
              const rc = ROLE_COLORS[adm.role] || ROLE_COLORS.staff;
              return (
                <div key={adm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px solid var(--border-color)', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {adm.username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adm.username}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <select
                      value={adm.role}
                      onChange={e => handleChangeAdminRole(adm.id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${rc.border}`, background: rc.bg, color: rc.color, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <option value="staff" style={{ background: 'var(--bg-surface-opaque)', color: 'var(--text-primary)' }}>Admin Staff</option>
                      <option value="finance" style={{ background: 'var(--bg-surface-opaque)', color: 'var(--text-primary)' }}>Admin Finance</option>
                      <option value="master" style={{ background: 'var(--bg-surface-opaque)', color: 'var(--text-primary)' }}>Master</option>
                    </select>
                    <button type="button" onClick={() => handleRevokeAdminSessions(adm.id, adm.username)}
                      title="Cabut semua sesi aktif Web & Mobile akun ini"
                      style={{ padding: '5px 10px', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '6px', color: 'var(--color-warning)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      Cabut Sesi
                    </button>
                    <button type="button" onClick={() => handleDeleteAdmin(adm.id, adm.username)}
                      style={{ padding: '5px 10px', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
