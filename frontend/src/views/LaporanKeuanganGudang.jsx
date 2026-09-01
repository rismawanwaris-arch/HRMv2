import React, { useState, useEffect, useCallback } from 'react';
import { financialApi } from '../services/api';

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const fmtRaw = (n) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n || 0);

function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const clean = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

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

export default function LaporanKeuanganGudang() {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financialApi.getWarehouseReport(period);
      setRows(res.data || []);
      setEdits({});
      setMsgs({});
    } catch (err) {
      console.error('Failed to load warehouse report:', err);
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
    const payload = {
      penj_gudang: parseNum(getEdit(row.branch_id, 'penj_gudang', row.penj_gudang)),
      pendapatan_lain: parseNum(getEdit(row.branch_id, 'pendapatan_lain', row.pendapatan_lain)),
      retur_penjualan: parseNum(getEdit(row.branch_id, 'retur_penjualan', row.retur_penjualan)),
      pend_konter_all: parseNum(getEdit(row.branch_id, 'pend_konter_all', row.pend_konter_all)),
      hpp_gudang: parseNum(getEdit(row.branch_id, 'hpp_gudang', row.hpp_gudang)),
      potongan_laba_petshop: parseNum(getEdit(row.branch_id, 'potongan_laba_petshop', row.potongan_laba_petshop)),
      biaya_operasional: parseNum(getEdit(row.branch_id, 'biaya_operasional', row.biaya_operasional)),
      biaya_bonus_penjualan: parseNum(getEdit(row.branch_id, 'biaya_bonus_penjualan', row.biaya_bonus_penjualan)),
      bagi_hasil_petshop: parseNum(getEdit(row.branch_id, 'bagi_hasil_petshop', row.bagi_hasil_petshop)),
      penyusutan: parseNum(getEdit(row.branch_id, 'penyusutan', row.penyusutan)),
      notes: getEdit(row.branch_id, 'notes', row.notes || ''),
    };

    setSaving(prev => ({ ...prev, [key]: true }));
    setMsgs(prev => ({ ...prev, [key]: '' }));
    try {
      await financialApi.upsertWarehouse(row.branch_id, period, payload);
      setMsgs(prev => ({ ...prev, [key]: 'ok' }));
      await load();
    } catch (err) {
      console.error('Failed to save warehouse financial data:', err);
      setMsgs(prev => ({ ...prev, [key]: 'err' }));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // Grand totals across all warehouse branches
  const totalPendapatan = rows.reduce((s, r) => s + r.total_pendapatan, 0);
  const totalHPP = rows.reduce((s, r) => s + r.total_hpp, 0);
  const totalLabaKotor = rows.reduce((s, r) => s + r.laba_kotor, 0);
  const totalBiaya = rows.reduce((s, r) => s + r.total_biaya, 0);
  const totalLabaBersih = rows.reduce((s, r) => s + r.laba_bersih, 0);

  const inputStyle = {
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    textAlign: 'right',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h1 className="view-title">Laporan Keuangan Gudang</h1>
          <p className="view-subtitle">Pendapatan grosir internal, HPP gudang, potongan 17%, dan laba bersih lokasi gudang</p>
        </div>
      </div>

      {/* Period picker bar */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>Periode Penggajian & Keuangan:</label>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <span style={{
          background: 'var(--primary)',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {periodLabel(period)}
        </span>
        <button
          onClick={load}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--bg-hover)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Summary KPI Cards */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Jumlah Pendapatan', value: totalPendapatan, color: '#3b82f6' },
            { label: 'Jumlah HPP', value: totalHPP, color: '#f59e0b' },
            { label: 'Laba Kotor', value: totalLabaKotor, color: totalLabaKotor >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Jumlah Biaya', value: totalBiaya, color: '#ef4444' },
            { label: 'Laba Bersih', value: totalLabaBersih, color: totalLabaBersih >= 0 ? '#10b981' : '#ef4444' },
          ].map(card => (
            <div key={card.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: card.color }}>
                {fmt(card.value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          Memuat data laporan keuangan gudang...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Belum ada Cabang bertipe "Gudang"
          </div>
          <p style={{ fontSize: '13px', margin: 0 }}>
            Silakan tambahkan atau ubah tipe lokasi cabang menjadi <strong>Gudang</strong> pada menu <strong>Cabang Outlet</strong>.
          </p>
        </div>
      )}

      {/* Warehouse Cards */}
      {!loading && rows.map(row => {
        const key = String(row.branch_id);
        const isSaving = saving[key];
        const msg = msgs[key];

        // Live edit values
        const curPenjGudang = parseNum(getEdit(row.branch_id, 'penj_gudang', row.penj_gudang));
        const curPendLain = parseNum(getEdit(row.branch_id, 'pendapatan_lain', row.pendapatan_lain));
        const curRetur = parseNum(getEdit(row.branch_id, 'retur_penjualan', row.retur_penjualan));
        const curPendKonterAll = parseNum(getEdit(row.branch_id, 'pend_konter_all', row.pend_konter_all));
        const curAsben = row.pendapatan_asben || 0;

        const livePendapatan = curPenjGudang + curPendLain - curRetur + curPendKonterAll + curAsben;

        const curHppGudang = parseNum(getEdit(row.branch_id, 'hpp_gudang', row.hpp_gudang));
        const curPotLabaPetshop = parseNum(getEdit(row.branch_id, 'potongan_laba_petshop', row.potongan_laba_petshop));
        const liveHPP = curHppGudang + curPotLabaPetshop;

        const liveLabaKotor = livePendapatan - liveHPP;

        const curOperasional = parseNum(getEdit(row.branch_id, 'biaya_operasional', row.biaya_operasional));
        const curPayroll = row.biaya_payroll || 0;
        const curBonusPenj = parseNum(getEdit(row.branch_id, 'biaya_bonus_penjualan', row.biaya_bonus_penjualan));
        const curBagiHasilPetshop = parseNum(getEdit(row.branch_id, 'bagi_hasil_petshop', row.bagi_hasil_petshop));
        const curPenyusutan = parseNum(getEdit(row.branch_id, 'penyusutan', row.penyusutan));

        // 17% Formula: (Laba Kotor - Potongan Laba Petshop - Biaya Operasional) * 17%
        const basis17 = liveLabaKotor - curPotLabaPetshop - curOperasional;
        const livePotongan17 = basis17 > 0 ? basis17 * 0.17 : 0;

        const liveTotalBiaya = curOperasional + livePotongan17 + curPayroll + curBonusPenj + curBagiHasilPetshop + curPenyusutan;
        const liveLabaBersih = liveLabaKotor - liveTotalBiaya;

        return (
          <div key={row.branch_id} className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🏢</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                    {row.branch_name} ({row.branch_code})
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Tipe Lokasi: Gudang & Kantor Pusat {row.has_petshop ? '• Ada Unit Petshop' : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Laba Bersih</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: liveLabaBersih >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(liveLabaBersih)}
                  </div>
                </div>

                {msg === 'ok' && (
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>✓ Tersimpan</span>
                )}
                {msg === 'err' && (
                  <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>✕ Gagal Simpan</span>
                )}

                <button
                  onClick={() => handleSave(row)}
                  disabled={isSaving}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isSaving ? 'Menyimpan...' : '💾 Simpan Laporan'}
                </button>
              </div>
            </div>

            {/* Grid 3 Columns: Pendapatan, HPP, Biaya */}
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              
              {/* Kolom 1: PENDAPATAN */}
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    1. PENDAPATAN
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6' }}>{fmt(livePendapatan)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Penjualan Gudang (Grosir Internal):
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'penj_gudang', fmtRaw(row.penj_gudang))}
                      onChange={e => setEdit(row.branch_id, 'penj_gudang', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Pend. Konter All (Grosir ke Semua Konter):
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'pend_konter_all', fmtRaw(row.pend_konter_all))}
                      onChange={e => setEdit(row.branch_id, 'pend_konter_all', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Pendapatan Lain-lain:
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'pendapatan_lain', fmtRaw(row.pendapatan_lain))}
                      onChange={e => setEdit(row.branch_id, 'pendapatan_lain', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#ef4444', marginBottom: '3px' }}>
                      Retur Penjualan (Pengurang):
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'retur_penjualan', fmtRaw(row.retur_penjualan))}
                      onChange={e => setEdit(row.branch_id, 'retur_penjualan', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px dashed rgba(59,130,246,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>Pendapatan ASBEN</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Otomatis dari Denda Absensi Gudang</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6' }}>
                      {fmt(curAsben)}
                    </span>
                  </div>
                </div>

                {/* Kolom 2 (Sub-section): HPP */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. HPP (HARGA POKOK)
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>{fmt(liveHPP)}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                        HPP Gudang:
                      </label>
                      <input
                        style={inputStyle}
                        type="text"
                        value={getEdit(row.branch_id, 'hpp_gudang', fmtRaw(row.hpp_gudang))}
                        onChange={e => setEdit(row.branch_id, 'hpp_gudang', e.target.value)}
                        placeholder="0"
                      />
                    </div>

                    {(row.has_petshop || row.potongan_laba_petshop > 0) && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Potongan Laba Petshop (HPP):
                        </label>
                        <input
                          style={inputStyle}
                          type="text"
                          value={getEdit(row.branch_id, 'potongan_laba_petshop', fmtRaw(row.potongan_laba_petshop))}
                          onChange={e => setEdit(row.branch_id, 'potongan_laba_petshop', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Laba Kotor Box */}
                <div style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: liveLabaKotor >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${liveLabaKotor >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>LABA KOTOR:</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: liveLabaKotor >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(liveLabaKotor)}
                  </span>
                </div>
              </div>

              {/* Kolom 2: BIAYA-BIAYA */}
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    3. BIAYA / PENGELUARAN
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{fmt(liveTotalBiaya)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Biaya Operasional Gudang:
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'biaya_operasional', fmtRaw(row.biaya_operasional))}
                      onChange={e => setEdit(row.branch_id, 'biaya_operasional', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Automatic 17% Formula */}
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px dashed rgba(139,92,246,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Potongan 17% (Formula)
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        (LK − Lab.Petshop − Operasional) × 17%
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6' }}>
                      {fmt(livePotongan17)}
                    </span>
                  </div>

                  {/* Automatic Payroll Staff */}
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px dashed rgba(239,68,68,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>Payroll Staff & Direksi</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Otomatis dari Total THP Karyawan Gudang</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>
                      {fmt(curPayroll)}
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Bonus Penjualan:
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'biaya_bonus_penjualan', fmtRaw(row.biaya_bonus_penjualan))}
                      onChange={e => setEdit(row.branch_id, 'biaya_bonus_penjualan', e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {(row.has_petshop || row.bagi_hasil_petshop > 0) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                        Bagi Hasil Petshop:
                      </label>
                      <input
                        style={inputStyle}
                        type="text"
                        value={getEdit(row.branch_id, 'bagi_hasil_petshop', fmtRaw(row.bagi_hasil_petshop))}
                        onChange={e => setEdit(row.branch_id, 'bagi_hasil_petshop', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Biaya Penyusutan:
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={getEdit(row.branch_id, 'penyusutan', fmtRaw(row.penyusutan))}
                      onChange={e => setEdit(row.branch_id, 'penyusutan', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Total Biaya Box */}
                <div style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>JUMLAH BIAYA:</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444' }}>
                    {fmt(liveTotalBiaya)}
                  </span>
                </div>
              </div>

              {/* Kolom 3: SUMMARY & REKAP LABA BERSIH */}
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                    4. REKAPITULASI & CATATAN
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Jumlah Pendapatan:</span>
                      <span style={{ fontWeight: 600 }}>{fmt(livePendapatan)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Jumlah HPP:</span>
                      <span style={{ fontWeight: 600 }}>{fmt(liveHPP)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Laba Kotor:</span>
                      <span style={{ fontWeight: 600, color: liveLabaKotor >= 0 ? '#10b981' : '#ef4444' }}>{fmt(liveLabaKotor)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Jumlah Biaya:</span>
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>{fmt(liveTotalBiaya)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Laba Bersih:</span>
                      <span style={{ fontWeight: 800, color: liveLabaBersih >= 0 ? '#10b981' : '#ef4444' }}>{fmt(liveLabaBersih)}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Catatan Tambahan:
                    </label>
                    <textarea
                      value={getEdit(row.branch_id, 'notes', row.notes || '')}
                      onChange={e => setEdit(row.branch_id, 'notes', e.target.value)}
                      placeholder="Tulis catatan keuangan gudang untuk periode ini..."
                      rows={4}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <button
                    onClick={() => handleSave(row)}
                    disabled={isSaving}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {isSaving ? 'Menyimpan...' : '💾 Simpan Laporan Gudang'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
}
