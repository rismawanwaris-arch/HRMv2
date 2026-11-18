import React from 'react';
import { createPortal } from 'react-dom';
import { exportEmployeeToPDF } from '../../utils/pdfExport';

function EmployeeCardModal({ emp, onClose }) {
  if (!emp) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Kartu Data Karyawan</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => exportEmployeeToPDF(emp)}
              style={{
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.35)',
                color: '#10b981',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'inherit',
              }}
            >
              🖨 Unduh PDF
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div style={{ padding: '10px 0' }}>
          {/* Header Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.1))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '24px', color: 'white', boxShadow: '0 4px 14px rgba(59,130,246,0.4)', flexShrink: 0 }}>
              {(emp.name || 'K').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>{emp.name}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                NIK: <strong>{emp.nik || '-'}</strong> | Jabatan: <strong>{emp.position || emp.employee_type || 'Frontliner'}</strong> | Kontrak: <strong style={{ color: 'var(--color-primary)' }}>{emp.contract_type || 'PKWT'}</strong>
                {emp.branch_name && <> | Cabang: <strong style={{ color: '#f59e0b' }}>{emp.branch_name}</strong></>}
              </p>
              <p style={{ fontSize: '12px', color: emp.is_manual_entry ? '#f59e0b' : 'var(--color-success)', margin: '4px 0 0', fontWeight: '500' }}>
                {emp.status === 'Resign' ? '● Status: Resign' : emp.status === 'Terminated' ? '● Status: Dikeluarkan' : '● Status: Aktif'}
                {(emp.start_date || emp.hire_date) && (
                  <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>
                    Diterima: <strong style={{ color: 'var(--text-primary)' }}>
                      {new Date(emp.start_date || emp.hire_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👤 Profil & Kontak
              </h3>
              <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Lahir</span> <span>{emp.birth_place || '-'}, {emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('id-ID') : '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Gender</span> <span>{emp.gender || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Agama</span> <span>{emp.religion || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Status Nikah</span> <span>{emp.marital_status || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>No. HP</span> <span>{emp.phone || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Email</span> <span>{emp.email || '-'}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Alamat Domisili</span>
                  <span style={{ marginTop: '2px', lineHeight: '1.4' }}>{emp.address_domicile || emp.address_ktp || '-'}</span>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏥 Kesehatan & Pendidikan
              </h3>
              <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Pendidikan</span> <span>{emp.education_level || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Jurusan</span> <span>{emp.education_major || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Tinggi/Berat</span> <span>{emp.height ? `${emp.height} cm` : '-'} / {emp.weight ? `${emp.weight} kg` : '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Fisik Umum</span> <span>{emp.physical_condition || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Buta Warna</span> <span>{emp.color_blind_test || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Gol. Darah</span> <span>{emp.blood_type || '-'}</span></div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💼 Administrasi Kepegawaian & Finansial
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Gaji Pokok</span> <strong style={{ color: 'var(--text-primary)' }}>Rp {Number(emp.salary || emp.salary_offered || 0).toLocaleString('id-ID')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Tunjangan</span> <strong style={{ color: 'var(--text-primary)' }}>Rp {Number(emp.allowance || 0).toLocaleString('id-ID')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Bank</span> <span>{emp.bank_name || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>No Rekening</span> <span>{emp.bank_account || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>NPWP</span> <span>{emp.npwp || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Ukuran Seragam</span> <span>{emp.uniform_size || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>BPJS Kesehatan</span> <span>{emp.bpjs_health || '-'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>BPJS TK</span> <span>{emp.bpjs_employment || '-'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EmployeeCardModal;
