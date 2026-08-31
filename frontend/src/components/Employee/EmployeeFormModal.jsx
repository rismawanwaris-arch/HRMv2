import React from 'react';

// ─── Reusable Form Field Components ───────────────────────────────────────────
const FormSection = ({ title, color = 'var(--color-primary)', children }) => (
  <div style={{ marginBottom: '28px' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '16px', paddingBottom: '10px',
      borderBottom: `1px solid var(--border-color)`
    }}>
      <div style={{ width: '3px', height: '18px', background: color, borderRadius: '2px' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color }}>{title}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      {children}
    </div>
  </div>
);

const Field = ({ label, full = false, children }) => (
  <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'none', letterSpacing: 0 }}>
      {label}
    </label>
    {children}
  </div>
);

const inp = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  display: 'block',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: 'inherit'
};

function EmployeeFormModal({ editEmployeeId, addError, submitting, handleAddManual, addForm, setAddForm, setShowAddModal, setEditEmployeeId, setAddError, emptyForm, branches }) {
  const f = (key) => (e) => setAddForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)', overflowY: 'auto' }}>
      <div style={{
        width: '100%', maxWidth: '720px', margin: '20px auto',
        background: 'var(--bg-surface-opaque)',
        border: '1px solid var(--border-color)', borderRadius: '24px',
        boxShadow: '0 32px 64px rgba(0,0,0,0.25)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '28px 32px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{editEmployeeId ? 'Edit Data Karyawan' : 'Tambah Karyawan Lama'}</h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{editEmployeeId ? 'Ubah informasi profil atau kontrak karyawan' : 'Data karyawan yang diterima sebelum sistem ini dibuat'}</p>
          </div>
          <button onClick={() => { setShowAddModal(false); setEditEmployeeId(null); setAddError(''); setAddForm(emptyForm); }}
            style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Error Banner */}
        {addError && (
          <div style={{ margin: '0 32px', marginTop: '20px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', color: '#f87171', fontSize: '14px' }}>
            ⚠️ {addError}
          </div>
        )}

        <form onSubmit={handleAddManual} style={{ padding: '24px 32px 32px' }}>

          {/* ── IDENTITAS DIRI ────────────────────────── */}
          <FormSection title="Identitas Diri" color="#8b5cf6">
            <Field label="Nama Lengkap *" full>
              <input style={inp} placeholder="Nama lengkap sesuai KTP" value={addForm.name} onChange={f('name')} required />
            </Field>
            <Field label="NIK (KTP)">
              <input style={inp} placeholder="16 digit NIK" value={addForm.nik} onChange={f('nik')} maxLength={16} />
            </Field>
            <Field label="Jenis Kelamin">
              <select style={inp} value={addForm.gender} onChange={f('gender')}>
                <option value="">Pilih</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </Field>
            <Field label="Tempat Lahir">
              <input style={inp} placeholder="Kota kelahiran" value={addForm.birth_place} onChange={f('birth_place')} />
            </Field>
            <Field label="Tanggal Lahir">
              <input type="date" style={inp} value={addForm.birth_date} onChange={f('birth_date')} />
            </Field>
            <Field label="Agama">
              <select style={inp} value={addForm.religion} onChange={f('religion')}>
                <option value="">Pilih</option>
                {['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Status Pernikahan">
              <select style={inp} value={addForm.marital_status} onChange={f('marital_status')}>
                <option value="">Pilih</option>
                <option value="Belum Menikah">Belum Menikah</option>
                <option value="Menikah">Menikah</option>
                <option value="Duda/Janda">Duda/Janda</option>
              </select>
            </Field>
            <Field label="Jumlah Tanggungan">
              <input type="number" style={inp} placeholder="0" min="0" max="20" value={addForm.dependents} onChange={f('dependents')} />
            </Field>
            <Field label="Golongan Darah">
              <select style={inp} value={addForm.blood_type} onChange={f('blood_type')}>
                <option value="">Pilih</option>
                {['A','B','AB','O','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </FormSection>

          {/* ── KONTAK & ALAMAT ───────────────────────── */}
          <FormSection title="Kontak & Alamat" color="#06b6d4">
            <Field label="No. HP / WhatsApp">
              <input style={inp} placeholder="08xxxxxxxxxx" value={addForm.phone} onChange={f('phone')} />
            </Field>
            <Field label="Email">
              <input type="email" style={inp} placeholder="email@contoh.com" value={addForm.email} onChange={f('email')} />
            </Field>
            <Field label="Alamat Sesuai KTP" full>
              <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} placeholder="Alamat lengkap sesuai KTP..." value={addForm.address_ktp} onChange={f('address_ktp')} rows={2} />
            </Field>
            <Field label="Alamat Domisili" full>
              <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} placeholder="Alamat tempat tinggal saat ini..." value={addForm.address_domicile} onChange={f('address_domicile')} rows={2} />
            </Field>
            <Field label="Kontak Darurat 1">
              <input style={inp} placeholder="Nama — No. HP" value={addForm.emergency_contact_1} onChange={f('emergency_contact_1')} />
            </Field>
            <Field label="Kontak Darurat 2">
              <input style={inp} placeholder="Nama — No. HP" value={addForm.emergency_contact_2} onChange={f('emergency_contact_2')} />
            </Field>
          </FormSection>

          {/* ── DATA KELUARGA ─────────────────────────── */}
          <FormSection title="Data Keluarga" color="#10b981">
            <Field label="Nama Ayah">
              <input style={inp} placeholder="Nama ayah kandung" value={addForm.father_name} onChange={f('father_name')} />
            </Field>
            <Field label="Nama Ibu">
              <input style={inp} placeholder="Nama ibu kandung" value={addForm.mother_name} onChange={f('mother_name')} />
            </Field>
            <Field label="Nama Pasangan (jika menikah)">
              <input style={inp} placeholder="Nama suami/istri" value={addForm.spouse_name} onChange={f('spouse_name')} />
            </Field>
          </FormSection>

          {/* ── PENDIDIKAN ────────────────────────────── */}
          <FormSection title="Riwayat Pendidikan" color="#f59e0b">
            <Field label="Pendidikan Terakhir">
              <select style={inp} value={addForm.education_level} onChange={f('education_level')}>
                <option value="">Pilih</option>
                {['SMP / MTs','SMA / SMK','D1 / D2 / D3','S1 / D4','S2','S3'].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Nama Institusi Pendidikan">
              <input style={inp} placeholder="Nama sekolah/universitas" value={addForm.education_institution} onChange={f('education_institution')} />
            </Field>
            <Field label="Jurusan / Program Studi">
              <input style={inp} placeholder="Jurusan atau bidang studi" value={addForm.education_major} onChange={f('education_major')} />
            </Field>
            <Field label="Tahun Lulus">
              <input style={inp} placeholder="Contoh: 2018 - 2022" value={addForm.education_years} onChange={f('education_years')} />
            </Field>
            <Field label="IPK / Nilai Akhir">
              <input style={inp} placeholder="Contoh: 3.50" value={addForm.education_grade} onChange={f('education_grade')} />
            </Field>
          </FormSection>

          {/* ── FISIK & KESEHATAN ─────────────────────── */}
          <FormSection title="Kondisi Fisik & Kesehatan" color="#ef4444">
            <Field label="Tinggi Badan (cm)">
              <input type="number" style={inp} placeholder="cm" min="100" max="250" value={addForm.height} onChange={f('height')} />
            </Field>
            <Field label="Berat Badan (kg)">
              <input type="number" style={inp} placeholder="kg" min="30" max="200" value={addForm.weight} onChange={f('weight')} />
            </Field>
            <Field label="Kondisi Fisik Umum">
              <select style={inp} value={addForm.physical_condition} onChange={f('physical_condition')}>
                <option value="Sehat">Sehat</option>
                <option value="Memiliki Disabilitas Ringan">Memiliki Disabilitas Ringan</option>
                <option value="Memerlukan Perhatian Medis">Memerlukan Perhatian Medis</option>
              </select>
            </Field>
            <Field label="Tes Buta Warna">
              <select style={inp} value={addForm.color_blind_test} onChange={f('color_blind_test')}>
                <option value="Normal">Normal</option>
                <option value="Buta Warna Parsial">Buta Warna Parsial</option>
                <option value="Buta Warna Total">Buta Warna Total</option>
              </select>
            </Field>
            <Field label="Riwayat Penyakit" full>
              <input style={inp} placeholder="Contoh: Asma, Diabetes, dll. (kosongkan jika tidak ada)" value={addForm.health_history} onChange={f('health_history')} />
            </Field>
            <Field label="Alergi" full>
              <input style={inp} placeholder="Contoh: Alergi debu, makanan tertentu (kosongkan jika tidak ada)" value={addForm.allergies} onChange={f('allergies')} />
            </Field>
          </FormSection>

          {/* ── ADMINISTRASI & KEUANGAN ───────────────── */}
          <FormSection title="Administrasi & Keuangan" color="#3b82f6">
            <Field label="NPWP">
              <input style={inp} placeholder="Nomor NPWP" value={addForm.npwp} onChange={f('npwp')} />
            </Field>
            <Field label="Ukuran Seragam">
              <select style={inp} value={addForm.uniform_size} onChange={f('uniform_size')}>
                <option value="">Pilih</option>
                {['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Nama Bank">
              <select style={inp} value={addForm.bank_name} onChange={f('bank_name')}>
                <option value="">Pilih Bank</option>
                {['BCA','BNI','BRI','Mandiri','BSI','CIMB Niaga','Danamon','Permata','BTN','Bank Lainnya'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="No. Rekening">
              <input style={inp} placeholder="Nomor rekening bank" value={addForm.bank_account} onChange={f('bank_account')} />
            </Field>
            <Field label="No. BPJS Kesehatan">
              <input style={inp} placeholder="Nomor BPJS Kesehatan" value={addForm.bpjs_health} onChange={f('bpjs_health')} />
            </Field>
            <Field label="No. BPJS Ketenagakerjaan">
              <input style={inp} placeholder="Nomor BPJS TK" value={addForm.bpjs_employment} onChange={f('bpjs_employment')} />
            </Field>
          </FormSection>

          {/* ── PENEMPATAN & KONTRAK ──────────────────── */}
          <FormSection title="Penempatan & Kontrak Kerja" color="#8b5cf6">
            <Field label="Cabang / Outlet Penempatan">
              <select style={inp} value={addForm.branch_id} onChange={f('branch_id')}>
                <option value="">Pilih Cabang</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
              </select>
            </Field>
            <Field label="🗓️ Tanggal Diterima / Mulai Bekerja">
              <input type="date" style={{ ...inp, borderColor: 'rgba(139,92,246,0.4)' }} value={addForm.hire_date} onChange={f('hire_date')} />
            </Field>
            <Field label="Tipe Kontrak">
              <select style={inp} value={addForm.contract_type} onChange={f('contract_type')}>
                <option value="PKWT">PKWT (Kontrak)</option>
                <option value="PKWTT">PKWTT (Tetap)</option>
              </select>
            </Field>
            <Field label="Gaji Pokok (Rp)">
              <input type="number" style={inp} placeholder="0" min="0" value={addForm.salary_offered} onChange={f('salary_offered')} />
            </Field>
            <Field label="Tunjangan (Rp)">
              <input type="number" style={inp} placeholder="0" min="0" value={addForm.allowance} onChange={f('allowance')} />
            </Field>
          </FormSection>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" onClick={() => { setShowAddModal(false); setEditEmployeeId(null); setAddError(''); setAddForm(emptyForm); }}
              style={{ flex: 1, padding: '14px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>
              Batal
            </button>
            <button type="submit" disabled={submitting}
              style={{ flex: 2, padding: '14px', background: submitting ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: '12px', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700, boxShadow: submitting ? 'none' : '0 4px 14px rgba(109,40,217,0.4)', transition: 'all 0.2s' }}>
              {submitting ? 'Menyimpan...' : (editEmployeeId ? '✓ Simpan Perubahan' : '✓ Simpan ke Data Karyawan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeFormModal;
