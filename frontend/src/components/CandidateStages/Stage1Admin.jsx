import React from 'react';

function Stage1Admin({ 
  candidate, stageData, setStageData, 
  documents, documentSlots, uploadingDocKey, 
  handleFileUpload, handleFilePreview, handleFileDelete, 
  handleStageSubmit 
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleStageSubmit(1, stageData); }}>
      <div className="eval-title">
        <span>Tahap 1: Seleksi Administrasi</span>
        <span className={`badge \${stageData.passed ? 'badge-hired' : 'badge-active'}`}>
          {stageData.passed ? 'Lolos' : 'Menunggu Evaluasi'}
        </span>
      </div>
      
      {/* DOCUMENT UPLOAD & MANAGEMENT SECTION */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'white' }}>Unggah & Berkas Administrasi (PDF / Image)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Format: .pdf, .jpg, .jpeg, .png (Maksimum 5 MB per file)</p>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-primary)', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
            {documents.length} / {documentSlots.length} Berkas Ada
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {documentSlots.map(slot => {
            const uploadedDoc = documents.find(d => d.doc_type === slot.key);
            const isUploading = uploadingDocKey === slot.key;

            return (
              <div 
                key={slot.key} 
                style={{ 
                  background: uploadedDoc ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)', 
                  border: `1px solid \${uploadedDoc ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px', color: 'white' }}>{slot.label}</strong>
                    {uploadedDoc ? (
                      <span style={{ fontSize: '10px', color: 'var(--color-success)', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                        ✓ Tersimpan
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        Belum Ada
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>{slot.desc}</p>
                  
                  {uploadedDoc && (
                    <div style={{ fontSize: '11px', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '6px', marginBottom: '10px' }}>
                      <div style={{ color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }} title={uploadedDoc.original_name}>
                        📄 {uploadedDoc.original_name}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
                        {(uploadedDoc.file_size / 1024).toFixed(1)} KB • {new Date(uploadedDoc.uploaded_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {uploadedDoc ? (
                    <>
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}
                        onClick={() => handleFilePreview(uploadedDoc.id)}
                      >
                        👁️ Buka File
                      </button>
                      <label 
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer', flex: 1, textAlign: 'center', margin: 0, opacity: isUploading ? 0.6 : 1 }}
                      >
                        {isUploading ? 'Uploading...' : '🔄 Ganti'}
                        <input 
                          type="file" 
                          accept=".pdf,.jpg,.jpeg,.png"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileUpload(slot.key, e)}
                          disabled={isUploading}
                        />
                      </label>
                      <button 
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                        onClick={() => handleFileDelete(uploadedDoc.id, slot.label)}
                      >
                        🗑️
                      </button>
                    </>
                  ) : (
                    <label 
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '11px', width: '100%', cursor: 'pointer', textAlign: 'center', margin: 0, opacity: isUploading ? 0.6 : 1 }}
                    >
                      {isUploading ? 'Mengunggah...' : '📤 Unggah Berkas'}
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileUpload(slot.key, e)}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="checklist-container">
        <div 
          className={`checklist-item \${stageData.berkas_lengkap ? 'checked' : ''}`}
          onClick={() => setStageData(p => ({ ...p, berkas_lengkap: p.berkas_lengkap ? 0 : 1 }))}
        >
          <div className="checkbox-custom"></div>
          <div className="checklist-label">
            <strong>Kelengkapan Berkas</strong>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CV, Ijazah, KTP, KK, SKCK, Pas Foto, Surat Sehat</div>
          </div>
        </div>

        <div 
          className={`checklist-item \${stageData.usia_sesuai ? 'checked' : ''}`}
          onClick={() => setStageData(p => ({ ...p, usia_sesuai: p.usia_sesuai ? 0 : 1 }))}
        >
          <div className="checkbox-custom"></div>
          <div className="checklist-label">
            <strong>Kesesuaian Usia</strong>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Usia kandidat masuk rentang 18 - 30 tahun</div>
          </div>
        </div>

        <div 
          className={`checklist-item \${stageData.pendidikan_sesuai ? 'checked' : ''}`}
          onClick={() => setStageData(p => ({ ...p, pendidikan_sesuai: p.pendidikan_sesuai ? 0 : 1 }))}
        >
          <div className="checkbox-custom"></div>
          <div className="checklist-label">
            <strong>Pendidikan Minimum Terpenuhi</strong>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Minimal SMA / SMK sederajat</div>
          </div>
        </div>

        <div 
          className={`checklist-item \${stageData.skck_bersih ? 'checked' : ''}`}
          onClick={() => setStageData(p => ({ ...p, skck_bersih: p.skck_bersih ? 0 : 1 }))}
        >
          <div className="checkbox-custom"></div>
          <div className="checklist-label">
            <strong>Surat SKCK Bersih</strong>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tidak ada catatan kepolisian / riwayat kriminalitas</div>
          </div>
        </div>

        <div 
          className={`checklist-item \${stageData.domisili_sesuai ? 'checked' : ''}`}
          onClick={() => setStageData(p => ({ ...p, domisili_sesuai: p.domisili_sesuai ? 0 : 1 }))}
        >
          <div className="checkbox-custom"></div>
          <div className="checklist-label">
            <strong>Domisili Relevan</strong>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tempat tinggal dekat dengan gerai konter (maks 30 menit)</div>
          </div>
        </div>
      </div>

      <div className="form-group form-group-full" style={{ marginBottom: '24px' }}>
        <label>Catatan Phone Screening (5-10 menit)</label>
        <textarea 
          value={stageData.phone_screen_notes || ''}
          onChange={(e) => setStageData(p => ({ ...p, phone_screen_notes: e.target.value }))}
          placeholder="Catat ketersediaan shift, ekspektasi gaji, motivasi kerja..."
          rows={4}
        />
      </div>

      <div className={`checklist-item \${stageData.passed ? 'checked' : ''}`} style={{ border: '1px dashed var(--border-color)', marginBottom: '24px' }}
           onClick={() => setStageData(p => ({ ...p, passed: p.passed ? 0 : 1 }))}>
        <div className="checkbox-custom"></div>
        <div className="checklist-label">
          <strong>Lulus Seleksi Administrasi & Panggil Tes Tertulis</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Menyetujui kandidat melangkah ke tahap tes berikutnya</div>
        </div>
      </div>

      {candidate.status === 'Active' && (
        <button type="submit" className="btn btn-primary">Simpan Hasil Tahap 1</button>
      )}
    </form>
  );
}

export default Stage1Admin;
