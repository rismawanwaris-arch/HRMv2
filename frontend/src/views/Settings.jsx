import React, { useState, useEffect } from 'react';
import { settingsApi } from '../services/api';

const fmt = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

export default function Settings() {
  const [settings, setSettings] = useState({ payroll_period_start_day: 29, payroll_period_end_day: 28, working_days_per_month: 25 });
  const [rules, setRules] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ min_count: '', max_count: '', penalty_per_occurrence: '' });
  const [ruleMsg, setRuleMsg] = useState(null);
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    Promise.all([settingsApi.getSettings(), settingsApi.getPenaltyRules()])
      .then(([s, r]) => {
        if (s.success) setSettings(prev => ({ ...prev, ...s.data }));
        if (r.success) setRules(r.data);
      })
      .finally(() => setLoadingSettings(false));
  }, []);

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
    </div>
  );
}
