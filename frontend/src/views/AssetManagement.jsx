import React, { useState, useEffect } from 'react';
import { assetApi, branchApi } from '../services/api';

const fmtRp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export default function AssetManagement() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'logs' | 'by-branch'

  // Master Data
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Asset List State
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Filters
  const [filterBranch, setFilterBranch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterStatus, setFilterStatus] = useState('Aktif');
  const [searchQuery, setSearchQuery] = useState('');

  // Logs State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterLogType, setFilterLogType] = useState('');

  // By-Branch Explorer State
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // Notification Toast
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Date helper
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showMutateModal, setShowMutateModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Asset Form
  const [addForm, setAddForm] = useState({
    name: '',
    category: 'Elektronik & HP',
    branch_id: '',
    purchase_date: getTodayStr(),
    purchase_cost: '',
    condition: 'Baik',
    status: 'Aktif',
    brand: '',
    serial_number: '',
    vendor_supplier: '',
    notes: '',
  });
  const [addPhotos, setAddPhotos] = useState([]);

  // Replace Asset Form (Penggantian)
  const [replaceForm, setReplaceForm] = useState({
    replacement_asset_name: '',
    replacement_brand: '',
    replacement_serial_number: '',
    replacement_cost: '',
    replacement_vendor: '',
    reason: 'Rusak / Tidak dapat diperbaiki',
    performed_by: localStorage.getItem('auth_username') || 'Wisnu (GA)',
    log_date: getTodayStr(),
    register_as_new_asset: true,
    notes: '',
  });
  const [replacePhotos, setReplacePhotos] = useState([]);

  // Mutate Asset Form (Mutasi Cabang)
  const [mutateForm, setMutateForm] = useState({
    to_branch_id: '',
    reason: 'Kebutuhan operasional cabang',
    performed_by: localStorage.getItem('auth_username') || 'Wisnu (GA)',
    log_date: getTodayStr(),
    notes: '',
  });

  // Service Asset Form (Perbaikan)
  const [serviceForm, setServiceForm] = useState({
    cost: '',
    reason: 'Servis / perbaikan kerusakan',
    new_condition: 'Baik',
    performed_by: localStorage.getItem('auth_username') || 'Wisnu (GA)',
    log_date: getTodayStr(),
    notes: '',
  });

  // Load branches
  useEffect(() => {
    setBranchesLoading(true);
    branchApi.getAll()
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setBranches(res.data);
          if (res.data.length > 0) {
            setSelectedBranchId(String(res.data[0].id));
            setAddForm(prev => ({ ...prev, branch_id: String(res.data[0].id) }));
          }
        }
      })
      .catch(err => console.error('Error loading branches:', err))
      .finally(() => setBranchesLoading(false));
  }, []);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await assetApi.getStats();
      if (res.success) setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch Assets
  const fetchAssets = async () => {
    setAssetsLoading(true);
    try {
      const params = {};
      if (filterBranch) params.branch_id = filterBranch;
      if (filterCategory) params.category = filterCategory;
      if (filterCondition) params.condition = filterCondition;
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;

      const res = await assetApi.getAll(params);
      if (res.success) setAssets(res.data);
    } catch (err) {
      console.error('Error loading assets:', err);
    } finally {
      setAssetsLoading(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const params = {};
      if (filterLogType) params.log_type = filterLogType;
      const res = await assetApi.getLogs(params);
      if (res.success) setLogs(res.data);
    } catch (err) {
      console.error('Error loading asset logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchAssets();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, filterBranch, filterCategory, filterCondition, filterStatus, searchQuery, filterLogType]);

  // Handle Add Asset Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.branch_id || !addForm.category) {
      alert('Nama aset, cabang, dan kategori wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.keys(addForm).forEach(k => {
        formData.append(k, addForm[k]);
      });
      addPhotos.forEach(f => {
        formData.append('photos', f);
      });

      const res = await assetApi.create(formData);
      showToast(res.message || 'Aset baru berhasil ditambahkan!');
      setShowAddModal(false);
      setAddPhotos([]);
      setAddForm({
        name: '',
        category: 'Elektronik & HP',
        branch_id: branches[0]?.id ? String(branches[0].id) : '',
        purchase_date: getTodayStr(),
        purchase_cost: '',
        condition: 'Baik',
        status: 'Aktif',
        brand: '',
        serial_number: '',
        vendor_supplier: '',
        notes: '',
      });
      fetchAssets();
      fetchStats();
    } catch (err) {
      alert(err.message || 'Gagal menambahkan aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Replace Asset Submit (Penggantian)
  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    if (!replaceForm.replacement_asset_name || !replaceForm.reason) {
      alert('Nama barang pengganti dan alasan penggantian wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.keys(replaceForm).forEach(k => {
        formData.append(k, replaceForm[k]);
      });
      replacePhotos.forEach(f => {
        formData.append('photos', f);
      });

      const res = await assetApi.replace(selectedAsset.id, formData);
      showToast(res.message || 'Penggantian aset berhasil disimpan!');
      setShowReplaceModal(false);
      setSelectedAsset(null);
      setReplacePhotos([]);
      fetchAssets();
      fetchStats();
      if (activeTab === 'logs') fetchLogs();
    } catch (err) {
      alert(err.message || 'Gagal menyimpan penggantian aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Mutate Submit
  const handleMutateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset || !mutateForm.to_branch_id) {
      alert('Cabang tujuan wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await assetApi.mutate(selectedAsset.id, mutateForm);
      showToast(res.message || 'Mutasi cabang berhasil disimpan!');
      setShowMutateModal(false);
      setSelectedAsset(null);
      fetchAssets();
      fetchStats();
    } catch (err) {
      alert(err.message || 'Gagal mutasi aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Service Submit
  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;

    setIsSubmitting(true);
    try {
      const res = await assetApi.service(selectedAsset.id, serviceForm);
      showToast(res.message || 'Catatan perbaikan berhasil disimpan!');
      setShowServiceModal(false);
      setSelectedAsset(null);
      fetchAssets();
      fetchStats();
    } catch (err) {
      alert(err.message || 'Gagal menyimpan catatan servis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;

    setIsSubmitting(true);
    try {
      const res = await assetApi.update(selectedAsset.id, selectedAsset);
      showToast(res.message || 'Aset berhasil diperbarui!');
      setShowEditModal(false);
      setSelectedAsset(null);
      fetchAssets();
    } catch (err) {
      alert(err.message || 'Gagal memperbarui aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Categories helper
  const categoriesList = [
    'Elektronik & HP',
    'Fasilitas & Mebel',
    'Branding & Neon Box',
    'Peralatan Kasir',
    'Keamanan & CCTV',
    'Operasional Lainnya'
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '10px',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✅</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            margin: '0 0 4px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>📦</span> Manajemen Aset & Inventaris Outlet
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Pencatatan penambahan aset baru, mutasi cabang, perbaikan, dan penggantian aset rusak di seluruh cabang konter.
          </p>
        </div>

        <button
          onClick={() => {
            setAddForm({
              name: '',
              category: 'Elektronik & HP',
              branch_id: branches[0]?.id ? String(branches[0].id) : '',
              purchase_date: getTodayStr(),
              purchase_cost: '',
              condition: 'Baik',
              status: 'Aktif',
              brand: '',
              serial_number: '',
              vendor_supplier: '',
              notes: '',
            });
            setAddPhotos([]);
            setShowAddModal(true);
          }}
          style={{
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
          }}
        >
          <span>➕</span> Catat Aset Baru
        </button>
      </div>

      {/* Top 4 KPI Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Aset Aktif Digunakan
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            {stats?.totalActive || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>unit</span>
          </div>
          <div style={{ fontSize: '11px', color: '#3b82f6' }}>
            Di seluruh cabang & konter
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Estimasi Nilai Inventaris
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981', margin: '4px 0 2px' }}>
            {fmtRp(stats?.totalValue || 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Total harga perolehan aset aktif
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Riwayat Aset Diganti
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', margin: '4px 0 2px' }}>
            {stats?.totalReplaced || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>barang</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Telah diperbarui dengan aset baru
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Perlu Perhatian / Servis
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: (stats?.needAttention || 0) > 0 ? '#ef4444' : 'var(--text-primary)', margin: '4px 0 2px' }}>
            {stats?.needAttention || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>unit</span>
          </div>
          <div style={{ fontSize: '11px', color: (stats?.needAttention || 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
            Kondisi rusak / dalam perbaikan
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '6px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-color)',
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'list', label: '📦 Daftar Seluruh Aset', count: assets.length },
          { id: 'logs', label: '🔄 Riwayat Penggantian & Mutasi', count: logs.length },
          { id: 'by-branch', label: '🏢 Inventaris per Cabang', count: null }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span style={{
                background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-primary)',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DAFTAR SELURUH ASET
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div>
          {/* Filters Bar */}
          <div className="card" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px 16px'
          }}>
            {/* Search */}
            <input
              type="text"
              placeholder="🔍 Cari nama, kode, serial/IMEI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: '1 1 200px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            />

            {/* Branch Filter */}
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <option value="">Semua Cabang</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <option value="">Semua Kategori</option>
              {categoriesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Condition Filter */}
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <option value="">Semua Kondisi</option>
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
              <option value="Dalam Perbaikan">Dalam Perbaikan</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <option value="">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Diganti">Diganti</option>
              <option value="Afkir/Scrap">Afkir/Scrap</option>
            </select>
          </div>

          {/* Asset Cards List */}
          {assetsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data aset...</div>
          ) : assets.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Tidak ada aset yang cocok dengan filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assets.map(asset => (
                <div key={asset.id} className="card" style={{
                  padding: '16px',
                  borderLeft: `4px solid ${
                    asset.status === 'Diganti' ? '#94a3b8' :
                    asset.condition === 'Rusak Berat' ? '#ef4444' :
                    asset.condition === 'Rusak Ringan' ? '#f59e0b' : '#10b981'
                  }`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      {/* Badges row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6'
                        }}>
                          {asset.branch_name} ({asset.branch_code})
                        </span>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)'
                        }}>
                          {asset.category}
                        </span>

                        <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {asset.asset_code}
                        </code>

                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background:
                            asset.condition === 'Baik' ? 'rgba(16, 185, 129, 0.15)' :
                            asset.condition === 'Rusak Ringan' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color:
                            asset.condition === 'Baik' ? '#10b981' :
                            asset.condition === 'Rusak Ringan' ? '#f59e0b' : '#ef4444'
                        }}>
                          {asset.condition}
                        </span>

                        {asset.status !== 'Aktif' && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(148, 163, 184, 0.2)',
                            color: '#94a3b8'
                          }}>
                            Status: {asset.status}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {asset.name} {asset.brand ? `• ${asset.brand}` : ''}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        📅 Tanggal Beli: <strong>{asset.purchase_date || '-'}</strong> • Nilai: <strong style={{ color: '#10b981' }}>{fmtRp(asset.purchase_cost)}</strong>
                        {asset.serial_number && ` • SN/IMEI: ${asset.serial_number}`}
                        {asset.vendor_supplier && ` • Vendor: ${asset.vendor_supplier}`}
                      </div>

                      {asset.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          💬 {asset.notes}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Tombol Penggantian Aset */}
                      {asset.status === 'Aktif' && (
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setReplaceForm({
                              replacement_asset_name: '',
                              replacement_brand: '',
                              replacement_serial_number: '',
                              replacement_cost: '',
                              replacement_vendor: '',
                              reason: 'Rusak / Perlu diganti baru',
                              performed_by: localStorage.getItem('auth_username') || 'Wisnu (GA)',
                              log_date: getTodayStr(),
                              register_as_new_asset: true,
                              notes: '',
                            });
                            setReplacePhotos([]);
                            setShowReplaceModal(true);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                          }}
                        >
                          <span>🔄</span> Ganti Aset
                        </button>
                      )}

                      {/* Tombol Mutasi Cabang */}
                      {asset.status === 'Aktif' && (
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setMutateForm({
                              to_branch_id: '',
                              reason: 'Kebutuhan operasional cabang',
                              performed_by: localStorage.getItem('auth_username') || 'Wisnu (GA)',
                              log_date: getTodayStr(),
                              notes: '',
                            });
                            setShowMutateModal(true);
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>🚚</span> Mutasi
                        </button>
                      )}

                      {/* Tombol Servis */}
                      {asset.status === 'Aktif' && (
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setServiceForm({
                              cost: '',
                              reason: 'Perbaikan / servis rutin',
                              new_condition: 'Baik',
                              performed_by: localStorage.getItem('auth_username') || 'Wisnu (GA)',
                              log_date: getTodayStr(),
                              notes: '',
                            });
                            setShowServiceModal(true);
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>🛠️</span> Servis
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setSelectedAsset({ ...asset });
                          setShowEditModal(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '14px',
                          cursor: 'pointer',
                          padding: '6px'
                        }}
                        title="Edit Aset"
                      >
                        ✏️
                      </button>

                      {/* Delete */}
                      <button
                        onClick={async () => {
                          if (confirm(`Hapus aset "${asset.name}" (${asset.asset_code})?`)) {
                            await assetApi.delete(asset.id);
                            showToast('Aset berhasil dihapus.');
                            fetchAssets();
                            fetchStats();
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '14px',
                          cursor: 'pointer',
                          padding: '6px'
                        }}
                        title="Hapus"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Photos */}
                  {Array.isArray(asset.photos) && asset.photos.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                      {asset.photos.map((photo, pIdx) => (
                        <a
                          key={pIdx}
                          href={assetApi.getPhotoUrl(photo)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={assetApi.getPhotoUrl(photo)}
                            alt="Foto Aset"
                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: LOG PENGGANTIAN, PENAMBAHAN & MUTASI ASET
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div>
          {/* Logs Filter Bar */}
          <div className="card" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px 16px'
          }}>
            <select
              value={filterLogType}
              onChange={(e) => setFilterLogType(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <option value="">Semua Jenis Transaksi</option>
              <option value="Penggantian">Penggantian Aset</option>
              <option value="Penambahan">Penambahan Aset Baru</option>
              <option value="Mutasi Cabang">Mutasi Cabang</option>
              <option value="Perbaikan/Servis">Perbaikan / Servis</option>
            </select>

            <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
              Total: <strong>{logs.length}</strong> Aktivitas Tercatat
            </div>
          </div>

          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat riwayat aset...</div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Belum ada riwayat penggantian atau mutasi aset.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.map(log => (
                <div key={log.id} className="card" style={{
                  padding: '14px 18px',
                  borderLeft: `4px solid ${
                    log.log_type === 'Penggantian' ? '#f59e0b' :
                    log.log_type === 'Penambahan' ? '#10b981' :
                    log.log_type === 'Mutasi Cabang' ? '#3b82f6' : '#8b5cf6'
                  }`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background:
                            log.log_type === 'Penggantian' ? 'rgba(245, 158, 11, 0.2)' :
                            log.log_type === 'Penambahan' ? 'rgba(16, 185, 129, 0.2)' :
                            log.log_type === 'Mutasi Cabang' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                          color:
                            log.log_type === 'Penggantian' ? '#f59e0b' :
                            log.log_type === 'Penambahan' ? '#10b981' :
                            log.log_type === 'Mutasi Cabang' ? '#3b82f6' : '#8b5cf6'
                        }}>
                          {log.log_type}
                        </span>

                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {log.asset_name} ({log.asset_code})
                        </span>

                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          📅 {log.log_date}
                        </span>
                      </div>

                      {/* Details based on log type */}
                      {log.log_type === 'Penggantian' && (
                        <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
                          ↳ <strong>Aset Pengganti Baru:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{log.replacement_asset_name}</span>
                          {log.cost > 0 && ` (Biaya: ${fmtRp(log.cost)})`}
                        </div>
                      )}

                      {log.log_type === 'Mutasi Cabang' && (
                        <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
                          ↳ Dipindahkan dari <strong>{log.from_branch_name}</strong> ➔ <strong>{log.to_branch_name}</strong>
                        </div>
                      )}

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Alasan / Catatan: {log.reason} {log.notes ? `• ${log.notes}` : ''}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Petugas: <strong>{log.performed_by}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: INVENTARIS PER CABANG
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'by-branch' && (
        <div>
          {/* Branch Selector */}
          <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              PILIH CABANG OUTLET UNTUK DILIHAT SELURUH ASETNYA:
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700
              }}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code}) - {b.city || 'Kota'}</option>
              ))}
            </select>
          </div>

          {/* Branch Assets List */}
          {(() => {
            const branchAssets = assets.filter(a => String(a.branch_id) === String(selectedBranchId));
            const activeBranchAssets = branchAssets.filter(a => a.status === 'Aktif');
            const totalBranchValue = activeBranchAssets.reduce((acc, curr) => acc + (curr.purchase_cost || 0), 0);

            return (
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div className="card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL ASET AKTIF DI CABANG INI</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>
                      {activeBranchAssets.length} Unit
                    </div>
                  </div>
                  <div className="card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL NILAI ASET CABANG</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                      {fmtRp(totalBranchValue)}
                    </div>
                  </div>
                </div>

                {activeBranchAssets.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Belum ada aset aktif yang terdaftar di cabang ini.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeBranchAssets.map(a => (
                      <div key={a.id} className="card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '14px' }}>
                            {a.name} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({a.asset_code})</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {a.category} • Kondisi: <strong style={{ color: a.condition === 'Baik' ? '#10b981' : '#f59e0b' }}>{a.condition}</strong> • Nilai: {fmtRp(a.purchase_cost)}
                          </div>
                        </div>

                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {a.brand || 'Standar'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: TAMBAH ASET BARU
      ─────────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                ➕ Pendaftaran / Penambahan Aset Baru
              </h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Nama Aset *
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Contoh: HP Kasir Redmi 10, Neon Box Bandar Kuota 2x1m"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Cabang Outlet *</label>
                  <select
                    value={addForm.branch_id}
                    onChange={(e) => setAddForm({ ...addForm, branch_id: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Kategori Aset *</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    {categoriesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tanggal Perolehan</label>
                  <input
                    type="date"
                    value={addForm.purchase_date}
                    onChange={(e) => setAddForm({ ...addForm, purchase_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Harga / Biaya Beli (Rp)</label>
                  <input
                    type="number"
                    value={addForm.purchase_cost}
                    onChange={(e) => setAddForm({ ...addForm, purchase_cost: e.target.value })}
                    placeholder="Contoh: 1800000"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Kondisi</label>
                  <select
                    value={addForm.condition}
                    onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Baik">Baik / Normal</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Merk / Brand</label>
                  <input
                    type="text"
                    value={addForm.brand}
                    onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                    placeholder="Contoh: Xiaomi, Sharp, Krisbow"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Serial Number / IMEI</label>
                  <input
                    type="text"
                    value={addForm.serial_number}
                    onChange={(e) => setAddForm({ ...addForm, serial_number: e.target.value })}
                    placeholder="No seri perangkat jika ada"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Catatan / Keterangan Spesifikasi
                </label>
                <textarea
                  rows="2"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="Catatan garansi, toko pembelian, kelengkapan..."
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Upload Foto */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  📸 Foto Aset (Kamera / Galeri)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files) setAddPhotos(Array.from(e.target.files));
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', color: 'var(--text-primary)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Aset Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: PENGGANTIAN ASET (REPLACE ASSET)
      ─────────────────────────────────────────────────────────────── */}
      {showReplaceModal && selectedAsset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#f59e0b' }}>
                🔄 Penggantian Aset ({selectedAsset.name})
              </h2>
              <button onClick={() => setShowReplaceModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--text-primary)'
            }}>
              Aset yang diganti: <strong>{selectedAsset.name}</strong> ({selectedAsset.asset_code}) di cabang <strong>{selectedAsset.branch_name}</strong>.
              Aset lama akan ditandai berstatus <em>'Diganti'</em> dan barang baru akan otomatis didaftarkan sebagai aset aktif pengganti.
            </div>

            <form onSubmit={handleReplaceSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Nama Barang / Aset Pengganti Baru *
                </label>
                <input
                  type="text"
                  value={replaceForm.replacement_asset_name}
                  onChange={(e) => setReplaceForm({ ...replaceForm, replacement_asset_name: e.target.value })}
                  placeholder="Contoh: HP Kasir Vivo Y16 (Baru)"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Merk Pengganti</label>
                  <input
                    type="text"
                    value={replaceForm.replacement_brand}
                    onChange={(e) => setReplaceForm({ ...replaceForm, replacement_brand: e.target.value })}
                    placeholder="Vivo"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Serial / IMEI Baru</label>
                  <input
                    type="text"
                    value={replaceForm.replacement_serial_number}
                    onChange={(e) => setReplaceForm({ ...replaceForm, replacement_serial_number: e.target.value })}
                    placeholder="IMEI / SN baru"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Biaya Penggantian (Rp)</label>
                  <input
                    type="number"
                    value={replaceForm.replacement_cost}
                    onChange={(e) => setReplaceForm({ ...replaceForm, replacement_cost: e.target.value })}
                    placeholder="1500000"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Alasan Penggantian *
                </label>
                <input
                  type="text"
                  value={replaceForm.reason}
                  onChange={(e) => setReplaceForm({ ...replaceForm, reason: e.target.value })}
                  placeholder="Contoh: Layar HP lama pecah mati total, plang neon box hancur kena angin"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tanggal Penggantian</label>
                  <input
                    type="date"
                    value={replaceForm.log_date}
                    onChange={(e) => setReplaceForm({ ...replaceForm, log_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Petugas GA (PIC)</label>
                  <input
                    type="text"
                    value={replaceForm.performed_by}
                    onChange={(e) => setReplaceForm({ ...replaceForm, performed_by: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Upload Foto Bukti Penggantian */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  📸 Foto Bukti Barang Rusak / Barang Baru
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files) setReplacePhotos(Array.from(e.target.files));
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', color: 'var(--text-primary)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowReplaceModal(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {isSubmitting ? 'Memproses...' : 'Simpan Penggantian Aset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: MUTASI CABANG
      ─────────────────────────────────────────────────────────────── */}
      {showMutateModal && selectedAsset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#3b82f6' }}>
                🚚 Mutasi Aset Antar Cabang
              </h2>
              <button onClick={() => setShowMutateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Memindahkan aset <strong>{selectedAsset.name}</strong> dari cabang asal <strong>{selectedAsset.branch_name}</strong>.
            </p>

            <form onSubmit={handleMutateSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Pindah ke Cabang Tujuan *
                </label>
                <select
                  value={mutateForm.to_branch_id}
                  onChange={(e) => setMutateForm({ ...mutateForm, to_branch_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Pilih Cabang Tujuan --</option>
                  {branches.filter(b => b.id !== selectedAsset.branch_id).map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Alasan Mutasi
                </label>
                <input
                  type="text"
                  value={mutateForm.reason}
                  onChange={(e) => setMutateForm({ ...mutateForm, reason: e.target.value })}
                  placeholder="Kebutuhan outlet baru / backup"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowMutateModal(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SERVIS / PERBAIKAN ASET
      ─────────────────────────────────────────────────────────────── */}
      {showServiceModal && selectedAsset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#8b5cf6' }}>
                🛠️ Servis / Perbaikan Aset
              </h2>
              <button onClick={() => setShowServiceModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Aset: <strong>{selectedAsset.name}</strong> ({selectedAsset.asset_code}) di <strong>{selectedAsset.branch_name}</strong>.
            </p>

            <form onSubmit={handleServiceSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Kondisi Setelah Servis
                </label>
                <select
                  value={serviceForm.new_condition}
                  onChange={(e) => setServiceForm({ ...serviceForm, new_condition: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="Baik">Baik (Normal Kembali)</option>
                  <option value="Dalam Perbaikan">Sedang Dikerjakan Teknisi</option>
                  <option value="Rusak Ringan">Bisa Pakai tapi Rusak Ringan</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Biaya Servis (Rp)
                </label>
                <input
                  type="number"
                  value={serviceForm.cost}
                  onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })}
                  placeholder="Contoh: 150000"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Catatan Kerusakan & Perbaikan
                </label>
                <input
                  type="text"
                  value={serviceForm.reason}
                  onChange={(e) => setServiceForm({ ...serviceForm, reason: e.target.value })}
                  placeholder="Ganti baterai, solder kabel power, teknisi Pak Budi"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowServiceModal(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Servis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT ASET
      ─────────────────────────────────────────────────────────────── */}
      {showEditModal && selectedAsset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                ✏️ Edit Informasi Aset
              </h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nama Aset</label>
                <input
                  type="text"
                  value={selectedAsset.name}
                  onChange={(e) => setSelectedAsset({ ...selectedAsset, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Kondisi</label>
                  <select
                    value={selectedAsset.condition}
                    onChange={(e) => setSelectedAsset({ ...selectedAsset, condition: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                    <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Status</label>
                  <select
                    value={selectedAsset.status}
                    onChange={(e) => setSelectedAsset({ ...selectedAsset, status: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Diganti">Diganti</option>
                    <option value="Afkir/Scrap">Afkir/Scrap</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Catatan</label>
                <textarea
                  rows="2"
                  value={selectedAsset.notes || ''}
                  onChange={(e) => setSelectedAsset({ ...selectedAsset, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
