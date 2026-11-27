import React, { useState, useEffect, useCallback } from 'react';
import { settingsApi } from '../services/api';
import { DEFAULT_DROPDOWN_OPTIONS } from '../utils/dropdownDefaults';

const DROPDOWN_GROUPS = [
  {
    key: 'asset_categories',
    label: 'Kategori Aset',
    icon: '📦',
    desc: 'Pilihan kategori di Manajemen Aset & Inventaris GA (Web & Mobile).',
  },
  {
    key: 'asset_conditions',
    label: 'Kondisi Aset',
    icon: '🛠️',
    desc: 'Pilihan kondisi fisik aset outlet (Baik, Rusak Ringan, dll.).',
  },
  {
    key: 'asset_statuses',
    label: 'Status Aset',
    icon: '🏷️',
    desc: 'Pilihan status siklus hidup aset (Aktif, Diganti, Afkir/Scrap, dll.).',
  },
  {
    key: 'visit_purposes',
    label: 'Tujuan Kunjungan',
    icon: '📋',
    desc: 'Pilihan tujuan kunjungan & audit outlet GA (Web & Mobile).',
  },
  {
    key: 'incident_categories',
    label: 'Kategori Insiden',
    icon: '⚠️',
    desc: 'Pilihan kategori laporan insiden / kendala outlet (Web & Mobile).',
  },
  {
    key: 'reimbursement_categories',
    label: 'Kategori Reimbursement',
    icon: '🧾',
    desc: 'Pilihan kategori klaim / reimbursement karyawan (Web & Mobile).',
  },
  {
    key: 'contract_types',
    label: 'Jenis Kontrak',
    icon: '📄',
    desc: 'Pilihan tipe kontrak karyawan pada pendaftaran Web & Mobile.',
  },
];

export default function DropdownSettings() {
  const [options, setOptions] = useState(DEFAULT_DROPDOWN_OPTIONS);
  const [defaults, setDefaults] = useState(DEFAULT_DROPDOWN_OPTIONS);
  const [activeKey, setActiveKey] = useState('asset_categories');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Add new item state
  const [newItem, setNewItem] = useState('');

  // Inline edit state
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await settingsApi.getDropdownOptions();
      if (res.success && res.data) {
        setOptions(prev => ({ ...prev, ...res.data }));
        if (res.defaults) setDefaults(res.defaults);
      } else {
        setMessage({ type: 'err', text: res.message || 'Gagal memuat daftar opsi dropdown.' });
      }
    } catch (err) {
      setMessage({ type: 'err', text: err.message || 'Gagal terhubung ke server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const persistGroup = async (groupKey, nextList, successText) => {
    const prevList = options[groupKey] || [];
    setOptions(prev => ({ ...prev, [groupKey]: nextList }));
    setSaving(true);
    setMessage(null);
    try {
      const res = await settingsApi.updateDropdownOptions({ [groupKey]: nextList });
      if (res.success) {
        if (res.data) setOptions(prev => ({ ...prev, ...res.data }));
        setMessage({ type: 'ok', text: successText || 'Perubahan tersimpan dan langsung tersinkron ke Web & Mobile.' });
      } else {
        setOptions(prev => ({ ...prev, [groupKey]: prevList }));
        setMessage({ type: 'err', text: res.message || 'Gagal menyimpan perubahan.' });
      }
    } catch (err) {
      setOptions(prev => ({ ...prev, [groupKey]: prevList }));
      setMessage({ type: 'err', text: err.message || 'Gagal menyimpan perubahan.' });
    } finally {
      setSaving(false);
    }
  };

  const currentGroup = DROPDOWN_GROUPS.find(g => g.key === activeKey) || DROPDOWN_GROUPS[0];
  const currentItems = options[activeKey] || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (currentItems.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
      setMessage({ type: 'err', text: `Opsi "${trimmed}" sudah ada di ${currentGroup.label}.` });
      return;
    }
    setNewItem('');
    await persistGroup(
      activeKey,
      [...currentItems, trimmed],
      `Opsi "${trimmed}" berhasil ditambahkan ke ${currentGroup.label}.`
    );
  };

  const startEdit = (idx, val) => {
    setEditingIndex(idx);
    setEditingValue(val);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleSaveEdit = async (idx) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setMessage({ type: 'err', text: 'Nama opsi tidak boleh kosong.' });
      return;
    }
    if (trimmed === currentItems[idx]) {
      cancelEdit();
      return;
    }
    const duplicate = currentItems.some((item, i) => i !== idx && item.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setMessage({ type: 'err', text: `Opsi "${trimmed}" sudah ada di ${currentGroup.label}.` });
      return;
    }
    const nextList = currentItems.map((item, i) => (i === idx ? trimmed : item));
    cancelEdit();
    await persistGroup(
      activeKey,
      nextList,
      `Opsi berhasil diubah menjadi "${trimmed}".`
    );
  };

  const handleDelete = async (idx) => {
    if (currentItems.length <= 1) {
      setMessage({ type: 'err', text: 'Minimal harus ada 1 opsi pada setiap kategori dropdown.' });
      return;
    }
    const target = currentItems[idx];
    if (!window.confirm(`Hapus opsi "${target}" dari ${currentGroup.label}?\n\nData lama yang sudah tersimpan di database tetap aman dan tidak terhapus.`)) {
      return;
    }
    if (editingIndex === idx) cancelEdit();
    const nextList = currentItems.filter((_, i) => i !== idx);
    await persistGroup(
      activeKey,
      nextList,
      `Opsi "${target}" berhasil dihapus dari ${currentGroup.label}.`
    );
  };

  const handleMove = async (idx, dir) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= currentItems.length) return;
    if (editingIndex !== null) cancelEdit();
    const nextList = [...currentItems];
    [nextList[idx], nextList[targetIdx]] = [nextList[targetIdx], nextList[idx]];
    await persistGroup(activeKey, nextList, 'Urutan opsi berhasil diperbarui.');
  };

  const handleResetDefault = async () => {
    if (!window.confirm(`Kembalikan daftar "${currentGroup.label}" ke pilihan bawaan (default)?`)) {
      return;
    }
    cancelEdit();
    const defaultList = [...(defaults[activeKey] || DEFAULT_DROPDOWN_OPTIONS[activeKey] || [])];
    await persistGroup(
      activeKey,
      defaultList,
      `Daftar "${currentGroup.label}" berhasil dikembalikan ke default.`
    );
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Pengaturan Kategori &amp; Dropdown
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Kelola kategori aset, tujuan kunjungan, kategori insiden, dan dropdown lainnya dari satu tempat. Semua perubahan otomatis tersinkron ke <strong>Website</strong> dan <strong>Aplikasi Mobile</strong> (<code>/api/mobile/master-data</code>).
          </p>
        </div>
        <button
          type="button"
          onClick={loadOptions}
          disabled={loading || saving}
          className="btn btn-secondary"
          style={{ fontSize: '13px', padding: '8px 14px' }}
        >
          {loading ? 'Memuat...' : '↻ Muat Ulang'}
        </button>
      </div>

      {/* Responsive 2-column layout: left menu list, right editor */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)',
        gap: '18px',
        alignItems: 'start',
      }}>
        {/* Left: Dropdown Category Menu */}
        <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: 'var(--text-muted)',
            padding: '4px 10px 8px',
          }}>
            Daftar Dropdown
          </div>
          {DROPDOWN_GROUPS.map(grp => {
            const isActive = grp.key === activeKey;
            const count = (options[grp.key] || []).length;
            return (
              <button
                key={grp.key}
                type="button"
                onClick={() => {
                  setActiveKey(grp.key);
                  setNewItem('');
                  cancelEdit();
                  setMessage(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid rgba(124,58,237,0.45)' : '1px solid transparent',
                  background: isActive ? 'rgba(124,58,237,0.14)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--text-primary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>{grp.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grp.label}</span>
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: isActive ? 'rgba(124,58,237,0.22)' : 'var(--bg-hover)',
                  color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Active Group CRUD Panel */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            flexWrap: 'wrap',
            paddingBottom: '14px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{currentGroup.icon}</span>
                <span>{currentGroup.label}</span>
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {currentGroup.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDefault}
              disabled={saving || loading}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              Reset Default
            </button>
          </div>

          {/* Add New Option Form */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              maxLength={80}
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              disabled={saving || loading}
              placeholder={`Tambah opsi baru untuk ${currentGroup.label}...`}
              style={{
                flex: 1,
                minWidth: '220px',
                padding: '10px 13px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={saving || loading || !newItem.trim()}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: saving || !newItem.trim() ? 'var(--bg-hover)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: saving || !newItem.trim() ? 'var(--text-muted)' : '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: saving || !newItem.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Tambah Opsi
            </button>
          </form>

          {/* Status Message */}
          {message && (
            <div style={{
              marginBottom: '14px',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              background: message.type === 'ok' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: message.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
              border: `1px solid ${message.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {message.type === 'ok' ? '✓ ' : '⚠ '}
              {message.text}
            </div>
          )}

          {/* Options List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Memuat opsi dropdown...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentItems.map((item, idx) => {
                const isEditing = editingIndex === idx;
                return (
                  <div
                    key={`${activeKey}-${idx}-${item}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-hover)',
                      border: isEditing ? '1px solid rgba(124,58,237,0.5)' : '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '180px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {idx + 1}
                      </span>

                      {isEditing ? (
                        <input
                          type="text"
                          maxLength={80}
                          autoFocus
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(idx);
                            } else if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(124,58,237,0.5)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveEdit(idx)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '7px',
                              border: 'none',
                              background: '#10b981',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: saving ? 'wait' : 'pointer',
                            }}
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={cancelEdit}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '7px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={saving || idx === 0}
                            onClick={() => handleMove(idx, -1)}
                            title="Pindah ke atas"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '7px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              cursor: saving || idx === 0 ? 'not-allowed' : 'pointer',
                              opacity: idx === 0 ? 0.4 : 1,
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={saving || idx === currentItems.length - 1}
                            onClick={() => handleMove(idx, 1)}
                            title="Pindah ke bawah"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '7px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              cursor: saving || idx === currentItems.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: idx === currentItems.length - 1 ? 0.4 : 1,
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => startEdit(idx, item)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '7px',
                              border: '1px solid rgba(59,130,246,0.35)',
                              background: 'var(--color-info-bg)',
                              color: 'var(--color-info)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: saving ? 'wait' : 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={saving || currentItems.length <= 1}
                            onClick={() => handleDelete(idx)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '7px',
                              border: '1px solid rgba(239,68,68,0.3)',
                              background: 'var(--color-danger-bg)',
                              color: 'var(--color-danger)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: saving || currentItems.length <= 1 ? 'not-allowed' : 'pointer',
                              opacity: currentItems.length <= 1 ? 0.45 : 1,
                            }}
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            marginTop: '16px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            💡 <strong>Info Sinkronisasi:</strong> Setiap penambahan, pengeditan, atau penghapusan langsung tersimpan ke server dan otomatis muncul di semua form Website serta endpoint Mobile <code>GET /api/mobile/master-data</code>. Data lama yang sudah tercatat di database tetap aman.
          </div>
        </div>
      </div>
    </div>
  );
}
