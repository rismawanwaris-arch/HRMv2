import React, { useState, useEffect } from 'react';
import { settingsApi, adminApi } from '../services/api';

const fmt = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

const ROLE_LABELS = { master: 'Master', finance: 'Admin Finance', staff: 'Admin Staff' };
const ROLE_COLORS = {
  master:  { bg: '#7c3aed22', color: '#a78bfa', border: '#7c3aed44' },
  finance: { bg: '#10b98122', color: '#34d399',  border: '#10b98144' },
  staff:   { bg: '#3b82f622', color: '#60a5fa',  border: '#3b82f644' },
};

export default function Settings({ currentRole = 'master' }) {
  const [settings, setSettings] = useState({ payroll_period_start_day: 29, payroll_period_end_day: 28, working_days_per_month: 25, shift_pagi_cutoff: '06:30', shift_siang_cutoff: '14:30' });
  const [rules, setRules] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [savingShift, setSavingShift] = useState(false);
  const [shiftMsg, setShiftMsg] = useState(null);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ min_count: '', max_count: '', penalty_per_occurrence: '' });
  const [ruleMsg, setRuleMsg] = useState(null);
  const [savingRule, setSavingRule] = useState(false);

  // Admin management state (master only)
  const [admins, setAdmins] = useState([]);
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

  const loadAdmins = () => adminApi.list().then(r => { if (r.success) setAdmins(r.data); }).catch(() => {});

  const loadMobileConfig = () => {
    settingsApi.getMobileConfig()
      .then(res => {
        if (res.success && res.data) {
          setMobileConfig(res.data);
          setCustomBaseUrl(res.data.custom_base_url || res.data.recommended_base_url || '');
        }
      })
      .catch(() => {});
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
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
    } catch {
      setMobileUrlMsg({ type: 'err', text: 'Kesalahan jaringan saat menyimpan URL.' });
    } finally {
      setSavingMobileUrl(false);
    }
  };

  const handleTestMobileApi = async () => {
    setTestingMobileApi(true);
    setMobileTestResult(null);
    const start = performance.now();
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
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
      if (res.ok) {
        const json = await res.json();
        setMobileTestResult({
          ok: true,
          latency,
          message: `Koneksi Terenkripsi & Valid (${res.status} OK) · ${json.data?.branches?.length || 0} cabang aktif siap disinkronkan.`
        });
      } else {
        setMobileTestResult({
          ok: false,
          latency,
          message: `Server merespon status ${res.status}: ${res.statusText}`
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
    Promise.all([settingsApi.getSettings(), settingsApi.getPenaltyRules()])
      .then(([s, r]) => {
        if (s.success) setSettings(prev => ({ ...prev, ...s.data }));
        if (r.success) setRules(r.data);
      })
      .finally(() => setLoadingSettings(false));
    loadMobileConfig();
    if (currentRole === 'master') loadAdmins();
  }, [currentRole]);

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
        setAdminMsg({ type: 'err', text: res.message });
      }
    } catch (err) {
      setAdminMsg({ type: 'err', text: err.message || 'Gagal.' });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id, username) => {
    if (!window.confirm(`Hapus akun "${username}"?`)) return;
    try {
      const res = await adminApi.delete(id);
      if (res.success) loadAdmins();
      else alert(res.message);
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
      const res = await settingsApi.updateSettings(settings);
      setSettingsMsg({ type: res.success ? 'success' : 'error', text: res.message });
    } catch {
      setSettingsMsg({ type: 'error', text: 'Gagal menyimpan pengaturan.' });
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
    } catch {
      setShiftMsg({ type: 'error', text: 'Gagal menyimpan pengaturan.' });
    } finally {
      setSavingShift(false);
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
    setSavingRule(true);
    setRuleMsg(null);
    try {
      const payload = {
        min_count: parseInt(ruleForm.min_count, 10),
        max_count: ruleForm.max_count !== '' ? parseInt(ruleForm.max_count, 10) : null,
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
      else setRuleMsg({ type: 'error', text: res.message });
    } catch {
      setRuleMsg({ type: 'error', text: 'Gagal menyimpan aturan.' });
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Hapus aturan keterlambatan ke-${rule.min_count}?`)) return;
    try {
      await settingsApi.deletePenaltyRule(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
    } catch {
      alert('Gagal menghapus aturan.');
    }
  };

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

      {/* Payroll Period Settings */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Pengaturan Periode Penggajian</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Tentukan tanggal mulai/akhir periode dan hari kerja standar per bulan.
          </p>
        </div>
        <form onSubmit={handleSaveSettings} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
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
              background: settingsMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: settingsMsg.type === 'success' ? '#34d399' : '#f87171',
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', maxWidth: '480px' }}>
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
              background: shiftMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: shiftMsg.type === 'success' ? '#34d399' : '#f87171',
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

      {/* Late Penalty Rules */}
      <div className="glass-panel">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Aturan Denda Keterlambatan (ASBEN)</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Denda per kejadian berdasarkan jumlah keterlambatan karyawan dalam satu periode.
            </p>
          </div>
          <button
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
                          color: rule.penalty_per_occurrence > 0 ? '#f59e0b' : 'var(--text-muted)',
                        }}>
                          {rule.penalty_per_occurrence > 0 ? `Rp ${fmt(rule.penalty_per_occurrence)}` : 'Tidak didenda'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => openEditRule(rule)}
                          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginRight: '8px' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
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
      {showRuleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-surface-opaque)', border: '1px solid var(--border-color)', borderRadius: '20px', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingRule ? 'Edit Aturan Denda' : 'Tambah Aturan Denda'}
              </h3>
              <button onClick={() => setShowRuleModal(false)} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <form onSubmit={handleSaveRule} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ruleMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {ruleMsg.text}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Keterlambatan ke- (dari) <span style={{ color: '#ef4444' }}>*</span>
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
                <button type="button" onClick={() => setShowRuleModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '14px' }}>
                  Batal
                </button>
                <button type="submit" disabled={savingRule}
                  style={{ flex: 2, padding: '12px', background: savingRule ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '10px', color: 'white', cursor: savingRule ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px' }}>
                  {savingRule ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              color: '#a78bfa',
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
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981',
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
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
              {mobileConfig?.sync_stats?.synced_visits ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Laporan audit cabang</div>
          </div>

          <div className="sync-metric-card" style={{ borderTop: '2px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>INSIDEN OUTLET</span>
              <span style={{ fontSize: '15px' }}>⚠️</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
              {mobileConfig?.sync_stats?.synced_incidents ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Temuan darurat lapangan</div>
          </div>

          <div className="sync-metric-card" style={{ borderTop: '2px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>KARYAWAN BARU</span>
              <span style={{ fontSize: '15px' }}>👤</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#8b5cf6', marginTop: '6px', fontFamily: 'var(--font-heading)' }}>
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
                <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.16)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  Otomatis Terdeteksi
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Gunakan URL ini di Flutter saat HP Android terhubung pada jaringan Wi-Fi yang sama dengan server.
              </div>
              <code style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: '#10b981', fontWeight: 600, background: 'var(--bg-surface)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {mobileConfig?.recommended_base_url || 'Memuat IP...'}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(mobileConfig?.recommended_base_url || '', 'wifi')}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: copiedKey === 'wifi' ? '#10b981' : 'var(--bg-surface)',
                color: copiedKey === 'wifi' ? '#fff' : 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: copiedKey === 'wifi' ? 'scale(1.04)' : 'scale(1)'
              }}
            >
              {copiedKey === 'wifi' ? '✓ URL Tersalin!' : '📋 Salin URL'}
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
              <code style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: '#38bdf8', fontWeight: 600, background: 'var(--bg-surface)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {mobileConfig?.emulator_base_url || 'http://10.0.2.2:5002/api'}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(mobileConfig?.emulator_base_url || '', 'emu')}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: copiedKey === 'emu' ? '#10b981' : 'var(--bg-surface)',
                color: copiedKey === 'emu' ? '#fff' : 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: copiedKey === 'emu' ? 'scale(1.04)' : 'scale(1)'
              }}
            >
              {copiedKey === 'emu' ? '✓ URL Tersalin!' : '📋 Salin URL'}
            </button>
          </div>

          {/* 3. URL Kustom / Tailscale ZimaOS / Domain Produksi */}
          <form onSubmit={handleSaveCustomBaseUrl} className="api-conn-card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                3. Endpoint Tailscale ZimaOS / Domain Produksi
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.14)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
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
                  minWidth: '240px',
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
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: copiedKey === 'custom' ? '#10b981' : 'var(--bg-surface)',
                  color: copiedKey === 'custom' ? '#fff' : 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copiedKey === 'custom' ? '✓ Tersalin' : '📋 Salin'}
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
              <div style={{ marginTop: '10px', fontSize: '12.5px', fontWeight: 600, color: mobileUrlMsg.type === 'ok' ? '#10b981' : '#ef4444', animation: 'popIn 0.25s ease forwards' }}>
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
                color: '#10b981',
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
                color: showDartSnippet ? '#818cf8' : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {showDartSnippet ? '▲ Sembunyikan Kode Dart' : '💻 Lihat Template ApiConfig.dart'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <a
              href="/docs/ANDROID_SECURITY_AND_SYNC_GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#34d399', textDecoration: 'none', fontWeight: 600 }}
            >
              🛡️ Panduan Keamanan Android ↗
            </a>
            <a
              href="/docs/FLUTTER_HRGA_SPEC.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}
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
            background: mobileTestResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${mobileTestResult.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            color: mobileTestResult.ok ? '#10b981' : '#ef4444',
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
              background: 'rgba(0,0,0,0.2)'
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                lib/core/api_config.dart
              </span>
              <button
                type="button"
                onClick={() => handleCopy(`class ApiConfig {
  static const String baseUrl = '${customBaseUrl || mobileConfig?.recommended_base_url || 'http://100.103.255.45:5002/api'}';
  static const String login = '\$baseUrl/mobile/login';
  static const String masterData = '\$baseUrl/mobile/master-data';
  static const String syncAsset = '\$baseUrl/mobile/sync/asset';
  static const String syncVisit = '\$baseUrl/mobile/sync/visit';
  static const String syncIncident = '\$baseUrl/mobile/sync/incident';
  static const String syncEmployee = '\$baseUrl/mobile/sync/employee';
}`, 'dart')}
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
{`class ApiConfig {
  // Base URL aktif (Tailscale ZimaOS / Local LAN)
  static const String baseUrl = '${customBaseUrl || mobileConfig?.recommended_base_url || 'http://100.103.255.45:5002/api'}';

  // Endpoint Autentikasi & Sinkronisasi (Wajib Header Authorization: Bearer <token>)
  static const String login = '\$baseUrl/mobile/login';
  static const String masterData = '\$baseUrl/mobile/master-data';
  static const String syncAsset = '\$baseUrl/mobile/sync/asset';
  static const String syncVisit = '\$baseUrl/mobile/sync/visit';
  static const String syncIncident = '\$baseUrl/mobile/sync/incident';
  static const String syncEmployee = '\$baseUrl/mobile/sync/employee';
}`}
            </pre>
          </div>
        )}
      </div>

      {/* ── MANAJEMEN ADMIN (master only) ── */}
      {currentRole === 'master' && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Manajemen Admin</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Kelola akun dan peran pengguna admin sistem</p>
            </div>
            <button
              onClick={() => { setShowAdminForm(p => !p); setAdminMsg(null); }}
              style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              {showAdminForm ? 'Batal' : '+ Tambah Admin'}
            </button>
          </div>

          {/* Form tambah admin */}
          {showAdminForm && (
            <form onSubmit={handleCreateAdmin} style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: '10px', alignItems: 'end' }}>
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
              {adminMsg && <div style={{ fontSize: '13px', color: adminMsg.type === 'ok' ? '#10b981' : '#ef4444' }}>{adminMsg.text}</div>}
            </form>
          )}

          {/* Daftar admin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {admins.map(adm => {
              const rc = ROLE_COLORS[adm.role] || ROLE_COLORS.staff;
              return (
                <div key={adm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px solid var(--border-color)', gap: '12px' }}>
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
                      <option value="staff">Admin Staff</option>
                      <option value="finance">Admin Finance</option>
                      <option value="master">Master</option>
                    </select>
                    <button onClick={() => handleDeleteAdmin(adm.id, adm.username)}
                      style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
            {admins.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Memuat...</div>}
          </div>
        </div>
      )}
    </div>
  );
}
