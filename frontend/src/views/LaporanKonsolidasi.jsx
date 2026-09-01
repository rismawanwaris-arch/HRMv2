import React, { useState, useEffect, useCallback } from 'react';
import { financialApi } from '../services/api';

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(period) {
  if (!period) return '';
  const [y, m] = period.split('-');
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function LaporanKonsolidasi({ setView }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [items, setItems] = useState([]);
  const [grandTotal, setGrandTotal] = useState({
    total_pendapatan: 0,
    total_hpp: 0,
    laba_kotor: 0,
    total_biaya: 0,
    laba_bersih: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'Konter' | 'Gudang'
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financialApi.getConsolidatedReport(period);
      if (res.success) {
        setItems(res.data || []);
        setGrandTotal(res.grand_total || {
          total_pendapatan: 0,
          total_hpp: 0,
          laba_kotor: 0,
          total_biaya: 0,
          laba_bersih: 0,
        });
      }
    } catch (err) {
      console.error('Failed to load consolidated financial report:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = items.filter(item => {
    if (filterType !== 'ALL' && item.location_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = item.branch_name.toLowerCase().includes(q);
      const matchCode = item.branch_code.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const konterCount = items.filter(i => i.location_type === 'Konter').length;
  const gudangCount = items.filter(i => i.location_type === 'Gudang').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="view-title">Laporan Konsolidasi Semua Lokasi</h1>
          <p className="view-subtitle">Ringkasan agregasi keuangan seluruh cabang konter dan gudang per periode</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handlePrint}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🖨️ Cetak / PDF
          </button>
        </div>
      </div>

      {/* Period & Filter Control Bar */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>Periode:</label>
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
            padding: '4px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {periodLabel(period)}
          </span>
          <button
            onClick={load}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            🔄 Muat Ulang
          </button>
        </div>

        {/* Location Type Filter Tabs & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari lokasi / kode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              width: '180px',
            }}
          />
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setFilterType('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filterType === 'ALL' ? 'var(--primary)' : 'transparent',
                color: filterType === 'ALL' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Semua ({items.length})
            </button>
            <button
              onClick={() => setFilterType('Konter')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filterType === 'Konter' ? 'var(--primary)' : 'transparent',
                color: filterType === 'Konter' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Konter ({konterCount})
            </button>
            <button
              onClick={() => setFilterType('Gudang')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filterType === 'Gudang' ? 'var(--primary)' : 'transparent',
                color: filterType === 'Gudang' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Gudang ({gudangCount})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: Grand Total Konsolidasi */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Pendapatan
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#3b82f6' }}>
              {fmt(grandTotal.total_pendapatan)}
            </div>
          </div>

          <div className="card" style={{ padding: '16px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
              Total HPP
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#f59e0b' }}>
              {fmt(grandTotal.total_hpp)}
            </div>
          </div>

          <div className="card" style={{ padding: '16px', textAlign: 'center', borderLeft: `4px solid ${grandTotal.laba_kotor >= 0 ? '#10b981' : '#ef4444'}` }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Laba Kotor
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: grandTotal.laba_kotor >= 0 ? '#10b981' : '#ef4444' }}>
              {fmt(grandTotal.laba_kotor)}
            </div>
          </div>

          <div className="card" style={{ padding: '16px', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Jumlah Biaya
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#ef4444' }}>
              {fmt(grandTotal.total_biaya)}
            </div>
          </div>

          <div className="card" style={{ padding: '16px', textAlign: 'center', borderLeft: `4px solid ${grandTotal.laba_bersih >= 0 ? '#10b981' : '#ef4444'}`, background: grandTotal.laba_bersih >= 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Laba Bersih Konsolidasi
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: grandTotal.laba_bersih >= 0 ? '#10b981' : '#ef4444' }}>
              {fmt(grandTotal.laba_bersih)}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Memuat data laporan konsolidasi...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Belum ada cabang outlet aktif.
        </div>
      )}

      {/* Main Consolidated Table */}
      {!loading && items.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 14px', width: '40px' }}>No</th>
                  <th style={{ padding: '12px 14px' }}>Lokasi / Cabang</th>
                  <th style={{ padding: '12px 14px', width: '90px' }}>Tipe</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Jml Pendapatan</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Jml HPP</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Laba Kotor</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Jml Biaya</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Laba Bersih</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', width: '80px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row, idx) => (
                  <tr
                    key={row.branch_id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.branch_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.branch_code}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: row.location_type === 'Gudang' ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.15)',
                        color: row.location_type === 'Gudang' ? '#a78bfa' : '#06b6d4',
                      }}>
                        {row.location_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>
                      {fmt(row.total_pendapatan)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 500, color: '#f59e0b' }}>
                      {fmt(row.total_hpp)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: row.laba_kotor >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmt(row.laba_kotor)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>
                      {fmt(row.total_biaya)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        background: row.laba_bersih >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: row.laba_bersih >= 0 ? '#10b981' : '#ef4444',
                      }}>
                        {fmt(row.laba_bersih)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {setView && (
                        <button
                          onClick={() => setView(row.location_type === 'Gudang' ? 'laporan-gudang' : 'laporan-konter')}
                          title="Buka Laporan"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          Detail ↗
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Grand Total Row */}
              <tfoot>
                <tr style={{
                  background: 'var(--bg-secondary)',
                  borderTop: '2px solid var(--border-color)',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  <td colSpan={3} style={{ padding: '14px', textAlign: 'center', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    GRAND TOTAL KONSOLIDASI
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right', color: '#3b82f6' }}>
                    {fmt(grandTotal.total_pendapatan)}
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right', color: '#f59e0b' }}>
                    {fmt(grandTotal.total_hpp)}
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right', color: grandTotal.laba_kotor >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(grandTotal.laba_kotor)}
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right', color: '#ef4444' }}>
                    {fmt(grandTotal.total_biaya)}
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontWeight: 900,
                      fontSize: '14px',
                      background: grandTotal.laba_bersih >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                      color: grandTotal.laba_bersih >= 0 ? '#10b981' : '#ef4444',
                    }}>
                      {fmt(grandTotal.laba_bersih)}
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
