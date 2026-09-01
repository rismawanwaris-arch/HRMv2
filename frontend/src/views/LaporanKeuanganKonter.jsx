import { useState, useEffect, useCallback } from 'react';
import { financialApi } from '../services/api';

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const fmtRaw = (n) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n || 0);

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(period) {
  if (!period) return '';
  const [y, m] = period.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function LabaBadge({ value }) {
  if (value > 0)
    return <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(value)}</span>;
  if (value < 0)
    return <span style={{ color: '#ef4444', fontWeight: 700 }}>{fmt(value)}</span>;
  return <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(value)}</span>;
}

export default function LaporanKeuanganKonter() {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financialApi.getOutletReport(period);
      setRows(res.data || []);
      setEdits({});
      setMsgs({});
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const getEdit = (branchId, field, fallback) => {
    const key = `${branchId}`;
    return edits[key]?.[field] !== undefined ? edits[key][field] : fallback;
  };

  const setEdit = (branchId, field, value) => {
    setEdits(prev => ({
      ...prev,
      [branchId]: { ...(prev[branchId] || {}), [field]: value },
    }));
  };

  const handleSave = async (row) => {
    const key = String(row.branch_id);
    const penjualan = parseFloat(String(getEdit(row.branch_id, 'penjualan', row.penjualan)).replace(/\./g, '').replace(',', '.')) || 0;
    const operasional = parseFloat(String(getEdit(row.branch_id, 'operasional', row.operasional)).replace(/\./g, '').replace(',', '.')) || 0;

    setSaving(prev => ({ ...prev, [key]: true }));
    setMsgs(prev => ({ ...prev, [key]: '' }));
    try {
      await financialApi.upsertOutlet(row.branch_id, period, { penjualan, operasional });
      setMsgs(prev => ({ ...prev, [key]: 'ok' }));
      await load();
    } catch {
      setMsgs(prev => ({ ...prev, [key]: 'err' }));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const totalPenjualan = rows.reduce((s, r) => s + r.penjualan, 0);
  const totalGaji = rows.reduce((s, r) => s + r.gaji, 0);
  const totalSewa = rows.reduce((s, r) => s + r.sewa, 0);
  const totalOpr = rows.reduce((s, r) => s + r.operasional, 0);
  const totalBeban = rows.reduce((s, r) => s + r.total_beban, 0);
  const totalLR = rows.reduce((s, r) => s + r.laba_rugi, 0);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1 className="view-title">Laporan Keuangan Konter</h1>
        <p className="view-subtitle">Pendapatan, beban, dan laba/rugi per cabang konter</p>
      </div>

      {/* Period picker */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Periode:</label>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px',
          }}
        />
        <span style={{
          background: 'var(--accent-blue, #3b82f6)', color: '#fff',
          padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
        }}>
          {periodLabel(period)}
        </span>
        <button
          onClick={load}
          style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'var(--accent-blue, #3b82f6)', color: '#fff', fontWeight: 600, fontSize: '13px',
          }}
        >
          Muat Ulang
        </button>
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Penjualan', value: totalPenjualan, color: '#10b981' },
            { label: 'Total Gaji', value: totalGaji, color: '#ef4444' },
            { label: 'Total Sewa', value: totalSewa, color: '#f59e0b' },
            { label: 'Total Operasional', value: totalOpr, color: '#8b5cf6' },
            { label: 'Total Beban', value: totalBeban, color: '#ef4444' },
            { label: 'Laba / Rugi', value: totalLR, color: totalLR >= 0 ? '#10b981' : '#ef4444' },
          ].map(card => (
            <div key={card.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>{card.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: card.color }}>{fmt(card.value)}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data...</div>
      )}

      {!loading && rows.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Tidak ada cabang konter aktif.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rows.map(row => {
            const key = String(row.branch_id);
            const isSaving = saving[key];
            const msg = msgs[key];
            const editPenjualan = getEdit(row.branch_id, 'penjualan', fmtRaw(row.penjualan));
            const editOperasional = getEdit(row.branch_id, 'operasional', fmtRaw(row.operasional));

            const previewPenjualan = parseFloat(String(editPenjualan).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
            const previewOpr = parseFloat(String(editOperasional).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
            const previewBeban = row.gaji + row.sewa + previewOpr;
            const previewLR = previewPenjualan - previewBeban;

            return (
              <div key={row.branch_id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* Branch header */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-secondary)',
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{row.branch_name}</span>
                    <span style={{
                      marginLeft: '10px', fontSize: '11px', fontWeight: 600,
                      background: 'var(--accent-blue, #3b82f620)', color: 'var(--accent-blue, #3b82f6)',
                      padding: '2px 8px', borderRadius: '10px',
                    }}>{row.branch_code}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {msg === 'ok' && <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600 }}>✓ Tersimpan</span>}
                    {msg === 'err' && <span style={{ color: '#ef4444', fontSize: '13px' }}>Gagal menyimpan</span>}
                    <button
                      onClick={() => handleSave(row)}
                      disabled={isSaving}
                      style={{
                        padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                        background: isSaving ? 'var(--text-muted)' : '#10b981', color: '#fff',
                        fontWeight: 600, fontSize: '13px',
                      }}
                    >
                      {isSaving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>

                {/* Two-column layout: pendapatan | beban */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                  {/* PENDAPATAN */}
                  <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      PENDAPATAN
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Penjualan Konter</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editPenjualan}
                          onChange={e => setEdit(row.branch_id, 'penjualan', e.target.value)}
                          placeholder="0"
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Total Pendapatan</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{fmt(previewPenjualan)}</span>
                      </div>
                    </div>
                  </div>

                  {/* BEBAN */}
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      BEBAN
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Gaji — read-only from payroll */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gaji Karyawan (Payroll)</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(row.gaji)}</span>
                      </div>
                      {/* Sewa — read-only from branch */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Biaya Sewa</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(row.sewa)}</span>
                      </div>
                      {/* Operasional — manual input */}
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Biaya Operasional</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editOperasional}
                          onChange={e => setEdit(row.branch_id, 'operasional', e.target.value)}
                          placeholder="0"
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Total Beban</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{fmt(previewBeban)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Laba/Rugi row */}
                <div style={{
                  borderTop: '2px solid var(--border-color)',
                  padding: '14px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: previewLR >= 0
                    ? 'rgba(16,185,129,0.06)'
                    : 'rgba(239,68,68,0.06)',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {previewLR >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}
                  </span>
                  <LabaBadge value={previewLR} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
