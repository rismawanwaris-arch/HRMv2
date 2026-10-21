import React, { useState, useEffect } from 'react';
import { outletActivityApi, branchApi } from '../services/api';

export default function OutletActivity() {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'visits' | 'incidents' | 'actions' | 'explorer'

  // Branches master list
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Daily Summary State
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Visits State
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitFilterBranch, setVisitFilterBranch] = useState('');
  const [visitFilterStatus, setVisitFilterStatus] = useState('');
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [visitSubmitting, setVisitSubmitting] = useState(false);

  // Visit Form State
  const [visitForm, setVisitForm] = useState({
    branch_id: '',
    visit_date: getTodayStr(),
    visit_time: new Date().toTimeString().slice(0, 5),
    visitor_name: localStorage.getItem('auth_username') || 'Wisnu',
    purpose: 'Audit Kebersihan & Keamanan',
    status: 'Completed',
    score_cleanliness: 90,
    score_security: 90,
    score_display: 90,
    score_sop: 90,
    notes: '',
    action_plan: '',
    staff_present: '',
  });
  const [visitFiles, setVisitFiles] = useState([]);

  // Incidents State
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentFilterBranch, setIncidentFilterBranch] = useState('');
  const [incidentFilterStatus, setIncidentFilterStatus] = useState('');
  const [incidentFilterCategory, setIncidentFilterCategory] = useState('');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);

  // Incident Form State
  const [incidentForm, setIncidentForm] = useState({
    branch_id: '',
    incident_date: getTodayStr(),
    category: 'Kerusakan Fasilitas',
    severity: 'Medium',
    title: '',
    description: '',
    action_taken: '',
    status: 'Open',
    reported_by: localStorage.getItem('auth_username') || 'Wisnu'
  });
  const [incidentFiles, setIncidentFiles] = useState([]);

  // Action Items State
  const [actionItems, setActionItems] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFilterStatus, setActionFilterStatus] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionForm, setActionForm] = useState({
    branch_id: '',
    task_description: '',
    assigned_to: '',
    due_date: getTodayStr(),
    priority: 'Medium'
  });

  // Store Explorer State
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branchHistory, setBranchHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Load Branches
  useEffect(() => {
    setBranchesLoading(true);
    branchApi.getAll()
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setBranches(res.data);
          if (res.data.length > 0) {
            setSelectedBranchId(String(res.data[0].id));
            setVisitForm(prev => ({ ...prev, branch_id: String(res.data[0].id) }));
            setIncidentForm(prev => ({ ...prev, branch_id: String(res.data[0].id) }));
            setActionForm(prev => ({ ...prev, branch_id: String(res.data[0].id) }));
          }
        }
      })
      .catch(err => console.error('Error loading branches:', err))
      .finally(() => setBranchesLoading(false));
  }, []);

  // Fetch Daily Summary
  const fetchSummary = async (date) => {
    setSummaryLoading(true);
    try {
      const res = await outletActivityApi.getSummary(date);
      if (res.success) {
        setSummaryData(res.data);
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'summary') {
      fetchSummary(selectedDate);
    }
  }, [activeTab, selectedDate]);

  // Fetch Visits
  const fetchVisits = async () => {
    setVisitsLoading(true);
    try {
      const params = {};
      if (visitFilterBranch) params.branch_id = visitFilterBranch;
      if (visitFilterStatus) params.status = visitFilterStatus;
      const res = await outletActivityApi.getVisits(params);
      if (res.success) setVisits(res.data);
    } catch (err) {
      console.error('Error loading visits:', err);
    } finally {
      setVisitsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'visits') {
      fetchVisits();
    }
  }, [activeTab, visitFilterBranch, visitFilterStatus]);

  // Fetch Incidents
  const fetchIncidents = async () => {
    setIncidentsLoading(true);
    try {
      const params = {};
      if (incidentFilterBranch) params.branch_id = incidentFilterBranch;
      if (incidentFilterStatus) params.status = incidentFilterStatus;
      if (incidentFilterCategory) params.category = incidentFilterCategory;
      const res = await outletActivityApi.getIncidents(params);
      if (res.success) setIncidents(res.data);
    } catch (err) {
      console.error('Error loading incidents:', err);
    } finally {
      setIncidentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    }
  }, [activeTab, incidentFilterBranch, incidentFilterStatus, incidentFilterCategory]);

  // Fetch Action Items
  const fetchActionItems = async () => {
    setActionLoading(true);
    try {
      const params = {};
      if (actionFilterStatus) params.status = actionFilterStatus;
      const res = await outletActivityApi.getActionItems(params);
      if (res.success) setActionItems(res.data);
    } catch (err) {
      console.error('Error loading action items:', err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'actions') {
      fetchActionItems();
    }
  }, [activeTab, actionFilterStatus]);

  // Fetch Store Explorer History
  const fetchBranchHistory = async (branchId) => {
    if (!branchId) return;
    setHistoryLoading(true);
    try {
      const res = await outletActivityApi.getBranchHistory(branchId);
      if (res.success) {
        setBranchHistory(res.data);
      }
    } catch (err) {
      console.error('Error loading branch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explorer' && selectedBranchId) {
      fetchBranchHistory(selectedBranchId);
    }
  }, [activeTab, selectedBranchId]);

  // Handle Copy to WhatsApp
  const handleCopyWhatsApp = async () => {
    if (!summaryData?.whatsappText) return;
    try {
      await navigator.clipboard.writeText(summaryData.whatsappText);
      setCopySuccess(true);
      showToast('Laporan berhasil disalin! Silakan paste di WhatsApp.');
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = summaryData.whatsappText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      showToast('Laporan berhasil disalin!');
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  // Change Date helper (+1 / -1 day)
  const shiftDate = (delta) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Save Visit
  const handleSaveVisit = async (e) => {
    e.preventDefault();
    if (!visitForm.branch_id) {
      alert('Pilih cabang outlet terlebih dahulu.');
      return;
    }

    setVisitSubmitting(true);
    try {
      const formData = new FormData();
      Object.keys(visitForm).forEach(k => {
        formData.append(k, visitForm[k]);
      });
      visitFiles.forEach(file => {
        formData.append('photos', file);
      });

      if (editingVisit) {
        await outletActivityApi.updateVisit(editingVisit.id, formData);
        showToast('Data kunjungan berhasil diperbarui.');
      } else {
        await outletActivityApi.createVisit(formData);
        showToast('Kunjungan outlet berhasil dicatat.');
      }

      setShowVisitModal(false);
      setEditingVisit(null);
      setVisitFiles([]);
      if (activeTab === 'visits') fetchVisits();
      if (activeTab === 'summary') fetchSummary(selectedDate);
      if (activeTab === 'explorer') fetchBranchHistory(selectedBranchId);
    } catch (err) {
      alert(err.message || 'Gagal menyimpan kunjungan.');
    } finally {
      setVisitSubmitting(false);
    }
  };

  // Save Incident
  const handleSaveIncident = async (e) => {
    e.preventDefault();
    if (!incidentForm.branch_id || !incidentForm.title || !incidentForm.description) {
      alert('Mohon lengkapi cabang, judul kejadian, dan deskripsi kronologi.');
      return;
    }

    setIncidentSubmitting(true);
    try {
      const formData = new FormData();
      Object.keys(incidentForm).forEach(k => {
        formData.append(k, incidentForm[k]);
      });
      incidentFiles.forEach(file => {
        formData.append('photos', file);
      });

      if (editingIncident) {
        await outletActivityApi.updateIncident(editingIncident.id, incidentForm);
        showToast('Kejadian berhasil diperbarui.');
      } else {
        await outletActivityApi.createIncident(formData);
        showToast('Kejadian outlet berhasil dicatat.');
      }

      setShowIncidentModal(false);
      setEditingIncident(null);
      setIncidentFiles([]);
      if (activeTab === 'incidents') fetchIncidents();
      if (activeTab === 'summary') fetchSummary(selectedDate);
      if (activeTab === 'explorer') fetchBranchHistory(selectedBranchId);
    } catch (err) {
      alert(err.message || 'Gagal mencatat kejadian.');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  // Save Action Item
  const handleSaveAction = async (e) => {
    e.preventDefault();
    if (!actionForm.branch_id || !actionForm.task_description) {
      alert('Pilih cabang dan tulis deskripsi tindak lanjut.');
      return;
    }

    try {
      await outletActivityApi.createActionItem(actionForm);
      showToast('Tindak lanjut (PR) berhasil ditambahkan.');
      setShowActionModal(false);
      setActionForm(prev => ({ ...prev, task_description: '', assigned_to: '' }));
      if (activeTab === 'actions') fetchActionItems();
      if (activeTab === 'summary') fetchSummary(selectedDate);
      if (activeTab === 'explorer') fetchBranchHistory(selectedBranchId);
    } catch (err) {
      alert(err.message || 'Gagal menambahkan PR.');
    }
  };

  // Toggle Action Status
  const handleToggleActionStatus = async (item) => {
    const nextStatus = item.status === 'Done' ? 'Pending' : 'Done';
    try {
      await outletActivityApi.updateActionItem(item.id, { status: nextStatus });
      showToast(`Tugas ditandai: ${nextStatus === 'Done' ? 'Selesai ✅' : 'Tertunda ⏳'}`);
      if (activeTab === 'actions') fetchActionItems();
      if (activeTab === 'summary') fetchSummary(selectedDate);
      if (activeTab === 'explorer') fetchBranchHistory(selectedBranchId);
    } catch (err) {
      alert('Gagal mengubah status tugas.');
    }
  };

  // Toggle Incident Status
  const handleToggleIncidentStatus = async (item) => {
    const nextStatus = item.status === 'Resolved' ? 'Open' : 'Resolved';
    try {
      await outletActivityApi.updateIncident(item.id, { status: nextStatus });
      showToast(`Status insiden diubah: ${nextStatus === 'Resolved' ? 'Terselesaikan ✅' : 'Dibuka kembali 🚨'}`);
      if (activeTab === 'incidents') fetchIncidents();
      if (activeTab === 'summary') fetchSummary(selectedDate);
      if (activeTab === 'explorer') fetchBranchHistory(selectedBranchId);
    } catch (err) {
      alert('Gagal mengubah status insiden.');
    }
  };

  // Open Edit Visit Modal
  const openEditVisit = (v) => {
    setEditingVisit(v);
    setVisitForm({
      branch_id: String(v.branch_id),
      visit_date: v.visit_date,
      visit_time: v.visit_time || '',
      visitor_name: v.visitor_name,
      purpose: v.purpose,
      status: v.status || 'Completed',
      score_cleanliness: v.score_cleanliness || 90,
      score_security: v.score_security || 90,
      score_display: v.score_display || 90,
      score_sop: v.score_sop || 90,
      notes: v.notes || '',
      action_plan: v.action_plan || '',
      staff_present: v.staff_present || '',
    });
    setVisitFiles([]);
    setShowVisitModal(true);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Toast Notification */}
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
          fontWeight: 600,
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
            <span>🏢</span> Aktivitas GA & Audit Outlet
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Log kunjungan toko, audit kebersihan & keamanan, pencatatan insiden per cabang, dan laporan harian ke WhatsApp.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setEditingVisit(null);
              setVisitForm({
                branch_id: branches[0]?.id ? String(branches[0].id) : '',
                visit_date: getTodayStr(),
                visit_time: new Date().toTimeString().slice(0, 5),
                visitor_name: localStorage.getItem('auth_username') || 'Wisnu',
                purpose: 'Audit Kebersihan & Keamanan',
                status: 'Completed',
                score_cleanliness: 90,
                score_security: 90,
                score_display: 90,
                score_sop: 90,
                notes: '',
                action_plan: '',
                staff_present: '',
              });
              setVisitFiles([]);
              setShowVisitModal(true);
            }}
            style={{
              background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <span>➕</span> Catat Kunjungan
          </button>

          <button
            onClick={() => {
              setEditingIncident(null);
              setIncidentForm({
                branch_id: branches[0]?.id ? String(branches[0].id) : '',
                incident_date: getTodayStr(),
                category: 'Kerusakan Fasilitas',
                severity: 'Medium',
                title: '',
                description: '',
                action_taken: '',
                status: 'Open',
                reported_by: localStorage.getItem('auth_username') || 'Wisnu'
              });
              setIncidentFiles([]);
              setShowIncidentModal(true);
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🚨</span> Lapor Kejadian
          </button>
        </div>
      </div>

      {/* Tabs Navigation (Scrollable on Mobile) */}
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
          { id: 'summary', label: '📊 Rangkuman & Kirim WA', count: null },
          { id: 'visits', label: '📝 Riwayat Kunjungan', count: visits.length },
          { id: 'incidents', label: '🚨 Log Kejadian Cabang', count: incidents.filter(i => i.status !== 'Resolved').length },
          { id: 'actions', label: '📌 Daftar PR & Tugas', count: actionItems.filter(a => a.status !== 'Done').length },
          { id: 'explorer', label: '🏢 Rekam Jejak per Cabang', count: null }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 16px',
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
                background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'rgba(239, 68, 68, 0.2)',
                color: activeTab === tab.id ? '#fff' : '#ef4444',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 800
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: RANGKUMAN HARIAN & COPY TO WA
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div>
          {/* Date Selector Bar */}
          <div className="card" style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            padding: '14px 18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => shiftDate(-1)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                ◀ Kemarin
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              />

              <button
                onClick={() => shiftDate(1)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                Besok ▶
              </button>

              {selectedDate !== getTodayStr() && (
                <button
                  onClick={() => setSelectedDate(getTodayStr())}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    color: 'var(--primary)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '12px'
                  }}
                >
                  Hari Ini
                </button>
              )}
            </div>

            {/* Copy WA Button Header */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCopyWhatsApp}
                style={{
                  background: copySuccess ? '#059669' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <span>{copySuccess ? '✅' : '📋'}</span>
                <span>{copySuccess ? 'Tersalin!' : 'Salin Laporan ke WA'}</span>
              </button>

              {summaryData?.whatsappText && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(summaryData.whatsappText)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📲</span> Buka WA
                </a>
              )}
            </div>
          </div>

          {/* Metric Cards Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Cabang Dikunjungi
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px' }}>
                {summaryData?.metrics?.totalVisits || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#3b82f6' }}>
                {summaryData?.metrics?.completedVisits || 0} Selesai • {summaryData?.metrics?.plannedVisits || 0} Rencana
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Rata-rata Skor Audit
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', margin: '6px 0 2px' }}>
                {summaryData?.metrics?.avgScore ? `${summaryData.metrics.avgScore}/100` : '-'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {summaryData?.metrics?.avgScore >= 85 ? '🌟 Kondisi Sangat Baik' : summaryData?.metrics?.avgScore >= 70 ? '⚠️ Butuh Perhatian' : 'Kunjungan Rutin'}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Kejadian / Insiden
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: summaryData?.metrics?.totalIncidents > 0 ? '#ef4444' : 'var(--text-primary)', margin: '6px 0 2px' }}>
                {summaryData?.metrics?.totalIncidents || 0}
              </div>
              <div style={{ fontSize: '11px', color: summaryData?.metrics?.criticalIncidents > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                {summaryData?.metrics?.criticalIncidents > 0 ? `🚨 ${summaryData.metrics.criticalIncidents} Urgensi Tinggi` : 'Aman terkendali'}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                PR & Tindak Lanjut Terbuka
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', margin: '6px 0 2px' }}>
                {summaryData?.metrics?.openActionItemsCount || 0}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Tugas perbaikan outlet
              </div>
            </div>
          </div>

          {/* WhatsApp Text Preview Box */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>💬</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Preview Laporan Siap Kirim WhatsApp
                </span>
              </div>
              <button
                onClick={handleCopyWhatsApp}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {copySuccess ? '✅ Tersalin' : '📋 Salin Teks'}
              </button>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              color: 'var(--text-primary)',
              maxHeight: '280px',
              overflowY: 'auto'
            }}>
              {summaryData?.whatsappText || 'Memuat laporan...'}
            </div>
          </div>

          {/* Visits List on this date */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Kunjungan Outlet ({summaryData?.visits?.length || 0})
            </h3>
            {summaryData?.visits?.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Belum ada catatan kunjungan pada tanggal {summaryData?.formattedDate || selectedDate}.
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => {
                      setEditingVisit(null);
                      setVisitForm(prev => ({ ...prev, visit_date: selectedDate }));
                      setShowVisitModal(true);
                    }}
                    className="btn btn-primary"
                    style={{ fontSize: '12px' }}
                  >
                    + Catat Kunjungan Tanggal Ini
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {summaryData.visits.map(v => (
                  <div key={v.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>
                            {v.branch_name} ({v.branch_code})
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: v.status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: v.status === 'Completed' ? '#10b981' : '#f59e0b'
                          }}>
                            {v.status === 'Completed' ? 'Selesai' : 'Rencana'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          🕒 {v.visit_time || 'Waktu tidak ditentukan'} • Petugas: <strong>{v.visitor_name}</strong> • Fokus: <em>{v.purpose}</em>
                        </div>
                      </div>

                      {v.overall_score > 0 && (
                        <div style={{
                          background: v.overall_score >= 85 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          border: `1px solid ${v.overall_score >= 85 ? '#10b981' : '#f59e0b'}`,
                          color: v.overall_score >= 85 ? '#10b981' : '#f59e0b',
                          fontWeight: 800,
                          fontSize: '14px',
                          padding: '4px 10px',
                          borderRadius: '8px'
                        }}>
                          Skor: {v.overall_score}/100
                        </div>
                      )}
                    </div>

                    {v.notes && (
                      <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px' }}>
                        <strong>Catatan:</strong> {v.notes}
                      </div>
                    )}

                    {v.action_plan && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#f59e0b' }}>
                        ↳ <strong>Rencana Tindak Lanjut:</strong> {v.action_plan}
                      </div>
                    )}

                    {/* Photos Preview if any */}
                    {v.photos && v.photos.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                        {v.photos.map((photo, pIdx) => (
                          <a
                            key={pIdx}
                            href={outletActivityApi.getPhotoUrl(photo)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={outletActivityApi.getPhotoUrl(photo)}
                              alt="Dokumentasi"
                              style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => openEditVisit(v)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        ✏️ Edit Kunjungan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: DAFTAR KUNJUNGAN (STORE VISITS)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'visits' && (
        <div>
          {/* Filter Bar */}
          <div className="card" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px 16px'
          }}>
            <select
              value={visitFilterBranch}
              onChange={(e) => setVisitFilterBranch(e.target.value)}
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

            <select
              value={visitFilterStatus}
              onChange={(e) => setVisitFilterStatus(e.target.value)}
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
              <option value="Completed">Selesai (Completed)</option>
              <option value="Planned">Rencana (Planned)</option>
            </select>

            <div style={{ marginLeft: 'auto' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Total: <strong>{visits.length}</strong> Kunjungan
              </span>
            </div>
          </div>

          {/* Visits Table / Mobile Cards */}
          {visitsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data kunjungan...</div>
          ) : visits.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Tidak ada data kunjungan yang cocok dengan filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visits.map(v => (
                <div key={v.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>
                          {v.branch_name}
                        </span>
                        <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.branch_code}</code>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: v.status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: v.status === 'Completed' ? '#10b981' : '#f59e0b'
                        }}>
                          {v.status === 'Completed' ? 'Selesai' : 'Rencana'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        📅 <strong>{v.visit_date}</strong> {v.visit_time ? `(${v.visit_time} WIB)` : ''} • Petugas: <strong>{v.visitor_name}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '2px' }}>
                        🎯 Fokus: <strong>{v.purpose}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {v.overall_score > 0 && (
                        <div style={{
                          background: v.overall_score >= 85 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          border: `1px solid ${v.overall_score >= 85 ? '#10b981' : '#f59e0b'}`,
                          color: v.overall_score >= 85 ? '#10b981' : '#f59e0b',
                          fontWeight: 800,
                          fontSize: '14px',
                          padding: '4px 10px',
                          borderRadius: '8px'
                        }}>
                          {v.overall_score}/100
                        </div>
                      )}

                      <button
                        onClick={() => openEditVisit(v)}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✏️ Edit
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Hapus catatan kunjungan ke ${v.branch_name} pada ${v.visit_date}?`)) {
                            await outletActivityApi.deleteVisit(v.id);
                            showToast('Kunjungan berhasil dihapus.');
                            fetchVisits();
                          }
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Sub Scores badges */}
                  {(v.score_cleanliness > 0 || v.score_security > 0 || v.score_display > 0 || v.score_sop > 0) && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {v.score_cleanliness > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          🧹 Kebersihan: <strong>{v.score_cleanliness}</strong>
                        </span>
                      )}
                      {v.score_security > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          🔒 Keamanan: <strong>{v.score_security}</strong>
                        </span>
                      )}
                      {v.score_display > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          🛍️ Display: <strong>{v.score_display}</strong>
                        </span>
                      )}
                      {v.score_sop > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          👥 SOP: <strong>{v.score_sop}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {v.notes && (
                    <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      📝 {v.notes}
                    </div>
                  )}

                  {v.action_plan && (
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#f59e0b' }}>
                      ↳ <strong>Rencana Lanjutan:</strong> {v.action_plan}
                    </div>
                  )}

                  {/* Photos */}
                  {v.photos && v.photos.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                      {v.photos.map((photo, pIdx) => (
                        <a
                          key={pIdx}
                          href={outletActivityApi.getPhotoUrl(photo)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={outletActivityApi.getPhotoUrl(photo)}
                            alt="Foto Visit"
                            style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }}
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
          TAB 3: LOG KEJADIAN CABANG (INCIDENTS PER OUTLET)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'incidents' && (
        <div>
          {/* Incident Filter Bar */}
          <div className="card" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px 16px'
          }}>
            <select
              value={incidentFilterBranch}
              onChange={(e) => setIncidentFilterBranch(e.target.value)}
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

            <select
              value={incidentFilterCategory}
              onChange={(e) => setIncidentFilterCategory(e.target.value)}
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
              <option value="Kebersihan">Kebersihan</option>
              <option value="Keamanan & Aset">Keamanan & Aset</option>
              <option value="Kerusakan Fasilitas">Kerusakan Fasilitas</option>
              <option value="Operasional & Kasir">Operasional & Kasir</option>
              <option value="Perilaku Karyawan">Perilaku Karyawan</option>
              <option value="Komplain Pelanggan">Komplain Pelanggan</option>
              <option value="Lainnya">Lainnya</option>
            </select>

            <select
              value={incidentFilterStatus}
              onChange={(e) => setIncidentFilterStatus(e.target.value)}
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
              <option value="Open">Belum Selesai (Open)</option>
              <option value="In Progress">Sedang Ditangani</option>
              <option value="Resolved">Selesai (Resolved)</option>
            </select>

            <div style={{ marginLeft: 'auto' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Total: <strong>{incidents.length}</strong> Kejadian
              </span>
            </div>
          </div>

          {incidentsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat data kejadian...</div>
          ) : incidents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Tidak ada catatan kejadian yang cocok dengan filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {incidents.map(inc => (
                <div key={inc.id} className="card" style={{
                  padding: '16px',
                  borderLeft: `4px solid ${
                    inc.severity === 'Critical' ? '#ef4444' :
                    inc.severity === 'High' ? '#f97316' :
                    inc.severity === 'Medium' ? '#f59e0b' : '#3b82f6'
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
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6'
                        }}>
                          {inc.branch_name}
                        </span>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)'
                        }}>
                          {inc.category}
                        </span>

                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background:
                            inc.severity === 'Critical' ? 'rgba(239, 68, 68, 0.2)' :
                            inc.severity === 'High' ? 'rgba(249, 115, 22, 0.2)' :
                            inc.severity === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color:
                            inc.severity === 'Critical' ? '#ef4444' :
                            inc.severity === 'High' ? '#f97316' :
                            inc.severity === 'Medium' ? '#f59e0b' : '#3b82f6'
                        }}>
                          {inc.severity}
                        </span>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: inc.status === 'Resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: inc.status === 'Resolved' ? '#10b981' : '#ef4444'
                        }}>
                          {inc.status === 'Resolved' ? 'Terselesaikan' : 'Belum Selesai'}
                        </span>
                      </div>

                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
                        {inc.title}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        📅 Tanggal: {inc.incident_date} • Pelapor: <strong>{inc.reported_by}</strong>
                        {inc.linked_employee_name && ` • Terkait Karyawan: ${inc.linked_employee_name}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleIncidentStatus(inc)}
                        style={{
                          background: inc.status === 'Resolved' ? 'rgba(239,68,68,0.1)' : 'rgba(16, 185, 129, 0.15)',
                          color: inc.status === 'Resolved' ? '#ef4444' : '#10b981',
                          border: `1px solid ${inc.status === 'Resolved' ? 'rgba(239,68,68,0.3)' : 'rgba(16, 185, 129, 0.4)'}`,
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}
                      >
                        {inc.status === 'Resolved' ? 'Buka Kembali' : '✓ Tandai Selesai'}
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Hapus catatan kejadian "${inc.title}"?`)) {
                            await outletActivityApi.deleteIncident(inc.id);
                            showToast('Kejadian berhasil dihapus.');
                            fetchIncidents();
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{
                    marginTop: '10px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-secondary)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    lineHeight: '1.5'
                  }}>
                    {inc.description}
                  </div>

                  {inc.action_taken && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#10b981' }}>
                      ↳ <strong>Tindakan yang Sudah Diambil:</strong> {inc.action_taken}
                    </div>
                  )}

                  {/* Photos */}
                  {inc.photos && inc.photos.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                      {inc.photos.map((photo, pIdx) => (
                        <a
                          key={pIdx}
                          href={outletActivityApi.getPhotoUrl(photo)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={outletActivityApi.getPhotoUrl(photo)}
                            alt="Foto Kejadian"
                            style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }}
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
          TAB 4: DAFTAR PR & ACTION ITEMS
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'actions' && (
        <div>
          <div className="card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px 16px'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={actionFilterStatus}
                onChange={(e) => setActionFilterStatus(e.target.value)}
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
                <option value="Pending">Tertunda (Pending)</option>
                <option value="Done">Selesai (Done)</option>
              </select>
            </div>

            <button
              onClick={() => setShowActionModal(true)}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              + Buat Tugas / PR Baru
            </button>
          </div>

          {actionLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat daftar PR...</div>
          ) : actionItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Tidak ada PR atau tindak lanjut perbaikan yang terbuka.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionItems.map(item => (
                <div key={item.id} className="card" style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  opacity: item.status === 'Done' ? 0.65 : 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexGrow: 1 }}>
                    <input
                      type="checkbox"
                      checked={item.status === 'Done'}
                      onChange={() => handleToggleActionStatus(item)}
                      style={{ width: '18px', height: '18px', marginTop: '3px', cursor: 'pointer' }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.branch_name}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: item.priority === 'High' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                          color: item.priority === 'High' ? '#ef4444' : '#f59e0b'
                        }}>
                          {item.priority}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginTop: '4px',
                        textDecoration: item.status === 'Done' ? 'line-through' : 'none'
                      }}>
                        {item.task_description}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        PIC: <strong>{item.assigned_to || 'Tidak ada'}</strong> • Target: <strong>{item.due_date || 'Fleksibel'}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (confirm('Hapus tugas tindak lanjut ini?')) {
                        await outletActivityApi.deleteActionItem(item.id);
                        showToast('Tugas dihapus.');
                        fetchActionItems();
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: REKAM JEJAK OUTLET (STORE EXPLORER)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'explorer' && (
        <div>
          {/* Branch Selector */}
          <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              PILIH CABANG OUTLET UNTUK DILIHAT REKAM JEJAKNYA:
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

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Memuat rekam jejak cabang...</div>
          ) : branchHistory ? (
            <div>
              {/* Branch Stats Banner */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL KUNJUNGAN</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {branchHistory.stats.totalVisits} Kali
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Terakhir: {branchHistory.stats.lastVisitDate || 'Belum pernah'}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RATA-RATA SKOR AUDIT</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                    {branchHistory.stats.avgScore > 0 ? `${branchHistory.stats.avgScore}/100` : '-'}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>INSIDEN BELUM SELESAI</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: branchHistory.stats.openIncidents > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                    {branchHistory.stats.openIncidents} Kejadian
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PR / PERBAIKAN PENDING</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                    {branchHistory.stats.pendingActions} Tugas
                  </div>
                </div>
              </div>

              {/* Incidents at this branch */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚨</span> Riwayat Insiden & Kejadian di Cabang Ini ({branchHistory.incidents.length})
                </h3>
                {branchHistory.incidents.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '10px 0' }}>
                    Tidak ada catatan insiden di cabang ini.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {branchHistory.incidents.map(inc => (
                      <div key={inc.id} style={{
                        background: 'var(--bg-secondary)',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        borderLeft: `3px solid ${inc.status === 'Resolved' ? '#10b981' : '#ef4444'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>{inc.incident_date}</span> • <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{inc.title}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: inc.status === 'Resolved' ? '#10b981' : '#ef4444' }}>
                            {inc.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {inc.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Visits history at this branch */}
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📝</span> Riwayat Kunjungan di Cabang Ini ({branchHistory.visits.length})
                </h3>
                {branchHistory.visits.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '10px 0' }}>
                    Belum ada riwayat kunjungan di cabang ini.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {branchHistory.visits.map(v => (
                      <div key={v.id} style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{v.visit_date}</strong> {v.visit_time ? `(${v.visit_time})` : ''} • Petugas: {v.visitor_name} • <em>{v.purpose}</em>
                          </div>
                          {v.overall_score > 0 && (
                            <span style={{ fontWeight: 800, color: '#10b981', fontSize: '13px' }}>
                              Skor: {v.overall_score}/100
                            </span>
                          )}
                        </div>
                        {v.notes && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Catatan: {v.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: FORM CATAT KUNJUNGAN (STORE VISIT MODAL)
      ─────────────────────────────────────────────────────────────── */}
      {showVisitModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {editingVisit ? '✏️ Edit Catatan Kunjungan' : '➕ Catat Kunjungan Outlet Baru'}
              </h2>
              <button
                onClick={() => setShowVisitModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVisit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Cabang Outlet *
                  </label>
                  <select
                    value={visitForm.branch_id}
                    onChange={(e) => setVisitForm({ ...visitForm, branch_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Status Kunjungan
                  </label>
                  <select
                    value={visitForm.status}
                    onChange={(e) => setVisitForm({ ...visitForm, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="Completed">Selesai (Sudah Dilakukan)</option>
                    <option value="Planned">Rencana (Jadwal Kunjungan)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    value={visitForm.visit_date}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Jam Kunjungan
                  </label>
                  <input
                    type="time"
                    value={visitForm.visit_time}
                    onChange={(e) => setVisitForm({ ...visitForm, visit_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Nama Petugas (Visitor)
                  </label>
                  <input
                    type="text"
                    value={visitForm.visitor_name}
                    onChange={(e) => setVisitForm({ ...visitForm, visitor_name: e.target.value })}
                    required
                    placeholder="Wisnu"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Tujuan / Fokus Kunjungan *
                </label>
                <select
                  value={visitForm.purpose}
                  onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    marginBottom: '6px'
                  }}
                >
                  <option value="Audit Kebersihan & Keamanan">Audit Kebersihan, 5R & Keamanan</option>
                  <option value="Edukasi & Coaching Kasir">Edukasi & Coaching Karyawan / Kasir</option>
                  <option value="Stock Opname & Cek Kas">Stock Opname Barang & Cek Uang Fisik</option>
                  <option value="Patroli & Kunjungan Rutin">Patroli & Kunjungan Rutin</option>
                  <option value="Investigasi Insiden / Kerusakan">Investigasi Insiden / Kerusakan Fasilitas</option>
                </select>
              </div>

              {/* Audit Checklist Scoring Box */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                  📊 Skor Penilaian Audit (0 - 100)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>🧹 Kebersihan & 5R</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={visitForm.score_cleanliness}
                      onChange={(e) => setVisitForm({ ...visitForm, score_cleanliness: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>🔒 Keamanan & Aset</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={visitForm.score_security}
                      onChange={(e) => setVisitForm({ ...visitForm, score_security: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>🛍️ Display & Produk</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={visitForm.score_display}
                      onChange={(e) => setVisitForm({ ...visitForm, score_display: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>👥 Kepatuhan SOP</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={visitForm.score_sop}
                      onChange={(e) => setVisitForm({ ...visitForm, score_sop: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Karyawan yang Bertugas saat Visit
                </label>
                <input
                  type="text"
                  value={visitForm.staff_present}
                  onChange={(e) => setVisitForm({ ...visitForm, staff_present: e.target.value })}
                  placeholder="Contoh: Siti (Kasir Pagi), Rian (Shift Siang)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Catatan / Temuan Lapangan
                </label>
                <textarea
                  rows="3"
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                  placeholder="Ceritakan kondisi outlet, temuan sampah, lampu, barang habis, atau interaksi kasir..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Rencana Tindak Lanjut (Action Plan)
                </label>
                <input
                  type="text"
                  value={visitForm.action_plan}
                  onChange={(e) => setVisitForm({ ...visitForm, action_plan: e.target.value })}
                  placeholder="Contoh: Tukang listrik datang besok jam 10, restock kartu perdana"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {/* Upload Foto Dokumentasi (Camera support on mobile) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  📸 Upload Foto Dokumentasi Lapangan (Maks. 5 Foto)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files) {
                      setVisitFiles(Array.from(e.target.files));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                />
                {visitFiles.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                    ✓ {visitFiles.length} foto dipilih untuk diunggah ke storage ZimaOS.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowVisitModal(false)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={visitSubmitting}
                  style={{
                    background: 'var(--primary)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {visitSubmitting ? 'Menyimpan...' : 'Simpan Kunjungan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: FORM LAPOR KEJADIAN / INSIDEN
      ─────────────────────────────────────────────────────────────── */}
      {showIncidentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#ef4444' }}>
                🚨 Lapor Kejadian / Insiden di Outlet
              </h2>
              <button
                onClick={() => setShowIncidentModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveIncident}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Cabang Outlet *
                </label>
                <select
                  value={incidentForm.branch_id}
                  onChange={(e) => setIncidentForm({ ...incidentForm, branch_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tanggal</label>
                  <input
                    type="date"
                    value={incidentForm.incident_date}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incident_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Kategori</label>
                  <select
                    value={incidentForm.category}
                    onChange={(e) => setIncidentForm({ ...incidentForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Kerusakan Fasilitas">Kerusakan Fasilitas</option>
                    <option value="Kebersihan">Kebersihan & 5R</option>
                    <option value="Keamanan & Aset">Keamanan & Aset</option>
                    <option value="Operasional & Kasir">Operasional & Kasir</option>
                    <option value="Perilaku Karyawan">Perilaku Karyawan</option>
                    <option value="Komplain Pelanggan">Komplain Pelanggan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tingkat Urgensi</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Low">Low (Rendah)</option>
                    <option value="Medium">Medium (Sedang)</option>
                    <option value="High">High (Tinggi)</option>
                    <option value="Critical">Critical (Darurat)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Judul Kejadian *
                </label>
                <input
                  type="text"
                  value={incidentForm.title}
                  onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                  placeholder="Contoh: AC Mati, Lampu Plang Rusak, Kasir Selisih Setoran"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Kronologi / Deskripsi Kejadian *
                </label>
                <textarea
                  rows="3"
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  placeholder="Ceritakan kejadiannya secara jelas agar selalu diingat..."
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Tindakan yang Sudah Diambil
                </label>
                <input
                  type="text"
                  value={incidentForm.action_taken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, action_taken: e.target.value })}
                  placeholder="Contoh: Sudah ditegur dan dicatat, sudah dipanggil teknisi"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Upload Foto Bukti Kejadian */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  📸 Foto Bukti Kejadian (Kamera / Galeri)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files) {
                      setIncidentFiles(Array.from(e.target.files));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={incidentSubmitting}
                  style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                >
                  {incidentSubmitting ? 'Menyimpan...' : 'Simpan Kejadian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: FORM BUAT PR / TINDAK LANJUT
      ─────────────────────────────────────────────────────────────── */}
      {showActionModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                📌 Tambah PR / Tugas Tindak Lanjut
              </h2>
              <button
                onClick={() => setShowActionModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAction}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Cabang Outlet *
                </label>
                <select
                  value={actionForm.branch_id}
                  onChange={(e) => setActionForm({ ...actionForm, branch_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Deskripsi Tugas / PR *
                </label>
                <input
                  type="text"
                  value={actionForm.task_description}
                  onChange={(e) => setActionForm({ ...actionForm, task_description: e.target.value })}
                  placeholder="Contoh: Ganti lampu neon sign, bersihkan debu etalase"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>PIC / Ditugaskan ke</label>
                  <input
                    type="text"
                    value={actionForm.assigned_to}
                    onChange={(e) => setActionForm({ ...actionForm, assigned_to: e.target.value })}
                    placeholder="Contoh: Pak Joko / Kasir"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target Selesai</label>
                  <input
                    type="date"
                    value={actionForm.due_date}
                    onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Prioritas</label>
                  <select
                    value={actionForm.priority}
                    onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Simpan PR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
