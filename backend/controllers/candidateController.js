const { query, uploadsDir } = require('../db');
const { generateAccessCode, getCandidateFolderName, upload } = require('../utils/helpers');
const { CANDIDATE_FIELDS, buildInsert, buildUpdate } = require('../utils/candidateFields');
const { decryptRow, blindIndex } = require('../utils/fieldCrypto');
const fs = require('fs');
const path = require('path');

// Onboarding is tracked outside the configurable recruitment_stages pipeline
// and is addressed by this sentinel stage number in the stage-update endpoint.
const ONBOARDING_STAGE_NUM = 8;

/**
 * Get list of candidates
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.getCandidates = async (req, res) => {
  try {
    const { status, stage, search } = req.query;
    let sql = 'SELECT id, name, nik, email, phone, current_stage, status, created_at FROM candidates WHERE 1=1';
    const params = [];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (stage) {
      sql += ' AND current_stage = ?';
      params.push(parseInt(String(stage), 10));
    }
    if (search) {
      // NIK may be encrypted at rest, so match it by exact blind index as well
      // as the legacy plaintext LIKE.
      sql += ' AND (name LIKE ? OR nik LIKE ? OR nik_bidx = ?)';
      params.push(`%${search}%`, `%${search}%`, blindIndex(search));
    }
    sql += ' ORDER BY id DESC';
    const candidatesList = await query.all(sql, params);
    res.json({ success: true, data: candidatesList.map(decryptRow) });
  } catch (error) {
    console.error('API Error (candidates list):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving candidates' });
  }
};

/**
 * Add a new candidate
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.addCandidate = async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: 'Nama kandidat wajib diisi' });
    }

    let accessCode = generateAccessCode();
    let isUnique = false;
    let retries = 0;
    while (!isUnique && retries < 10) {
      const existing = await query.get('SELECT id FROM candidates WHERE access_code = ?', [accessCode]);
      if (!existing) {
        isUnique = true;
      } else {
        accessCode = generateAccessCode();
        retries++;
      }
    }
    if (!isUnique) {
      return res.status(500).json({ success: false, message: 'Gagal membuat kode akses unik. Coba lagi.' });
    }

    const firstStage = await query.get('SELECT id FROM recruitment_stages WHERE is_active = 1 ORDER BY order_num ASC LIMIT 1');
    const initialStageId = firstStage ? firstStage.id : 1;

    const { columns, placeholders, values } = buildInsert(CANDIDATE_FIELDS, req.body);
    const insertSql = `
      INSERT INTO candidates (access_code, ${columns}, status, current_stage)
      VALUES (?, ${placeholders}, 'Active', ?)
    `;

    const result = await query.run(insertSql, [accessCode, ...values, initialStageId]);

    const candidateId = result.id;

    await query.run('INSERT INTO stage1_admin (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO stage2_written_test (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO stage3_simulation (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO stage4_interview_hrd (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO stage5_interview_user (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO stage6_mcu_ref (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO stage7_offering (candidate_id) VALUES (?)', [candidateId]);
    await query.run('INSERT INTO onboarding (candidate_id) VALUES (?)', [candidateId]);

    res.status(201).json({
      success: true,
      message: 'Kandidat berhasil ditambahkan',
      candidateId,
      accessCode
    });
  } catch (error) {
    console.error('API Error (add candidate):', error);
    if (error instanceof Error && /UNIQUE constraint failed.*(candidates\.nik|nik_bidx)/.test(error.message)) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar dalam sistem.' });
    }
    res.status(500).json({ success: false, message: 'Server error saving candidate' });
  }
};

/**
 * Get specific candidate detail
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
exports.getCandidateDetail = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id), 10);
    const candidate = await query.get('SELECT * FROM candidates WHERE id = ?', [candidateId]);
    if (!candidate) return res.status(404).json({ success: false, message: 'Kandidat tidak ditemukan' });
    decryptRow(candidate);
    delete candidate.nik_bidx;

    const s1 = await query.get('SELECT * FROM stage1_admin WHERE candidate_id = ?', [candidateId]);
    const s2 = await query.get('SELECT * FROM stage2_written_test WHERE candidate_id = ?', [candidateId]);
    const s3 = await query.get('SELECT * FROM stage3_simulation WHERE candidate_id = ?', [candidateId]);
    const s4 = await query.get('SELECT * FROM stage4_interview_hrd WHERE candidate_id = ?', [candidateId]);
    const s5 = await query.get('SELECT * FROM stage5_interview_user WHERE candidate_id = ?', [candidateId]);
    const s6 = await query.get('SELECT * FROM stage6_mcu_ref WHERE candidate_id = ?', [candidateId]);
    const s7 = await query.get('SELECT * FROM stage7_offering WHERE candidate_id = ?', [candidateId]);
    const ob = await query.get('SELECT * FROM onboarding WHERE candidate_id = ?', [candidateId]);
    const docs = await query.all('SELECT * FROM candidate_documents WHERE candidate_id = ? ORDER BY id DESC', [candidateId]);
    const genericEvals = await query.all('SELECT * FROM stage_generic_evaluations WHERE candidate_id = ?', [candidateId]);

    res.json({
      success: true,
      candidate: {
        ...candidate,
        stage1: s1, stage2: s2, stage3: s3, stage4: s4, stage5: s5, stage6: s6, stage7: s7,
        onboarding: ob, documents: docs, genericEvaluations: genericEvals
      }
    });
  } catch (error) {
    console.error('API Error (candidate detail):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving candidate details' });
  }
};

/**
 * Update candidate profile biodata fields.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<any>}
 */
exports.updateCandidate = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id));
    const { status, current_stage } = req.body;

    const existing = await query.get('SELECT id FROM candidates WHERE id = ?', [candidateId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Kandidat tidak ditemukan' });

    const { assignments, values } = buildUpdate(CANDIDATE_FIELDS, req.body);
    const updateSql = `
      UPDATE candidates
      SET ${assignments}, status = ?, current_stage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await query.run(updateSql, [...values, status || 'Active', current_stage || 1, candidateId]);
    res.json({ success: true, message: 'Data kandidat berhasil diperbarui.' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar dalam sistem.' });
    }
    console.error('API Error (update candidate):', error);
    res.status(500).json({ success: false, message: 'Server error updating candidate' });
  }
};

/**
 * Delete candidate from system and database.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<any>}
 */
exports.deleteCandidate = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id));
    const existing = await query.get('SELECT id FROM candidates WHERE id = ?', [candidateId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Kandidat tidak ditemukan' });
    await query.run('DELETE FROM candidates WHERE id = ?', [candidateId]);
    res.json({ success: true, message: 'Kandidat berhasil dihapus' });
  } catch (error) {
    console.error('API Error (delete candidate):', error);
    res.status(500).json({ success: false, message: 'Server error deleting candidate' });
  }
};

/**
 * Retrieve uploaded documents metadata for a candidate.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<any>}
 */
exports.getCandidateDocuments = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id));
    const docs = await query.all('SELECT * FROM candidate_documents WHERE candidate_id = ? ORDER BY id DESC', [candidateId]);
    res.json({ success: true, documents: docs });
  } catch (error) {
    console.error('API Error (get documents):', error);
    res.status(500).json({ success: false, message: 'Server error loading documents' });
  }
};

/**
 * Stream/download candidate document binary payload.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<any>}
 */
exports.downloadDocument = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id));
    const docId = parseInt(String(req.params.doc_id));
    const doc = await query.get('SELECT * FROM candidate_documents WHERE id = ? AND candidate_id = ?', [docId, candidateId]);
    if (!doc || !fs.existsSync(doc.file_path)) return res.status(404).send('File tidak ditemukan');
    res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.sendFile(path.resolve(doc.file_path));
  } catch (error) {
    console.error('API Error (serve document file):', error);
    res.status(500).send('Server error retrieving file');
  }
};

/**
 * Delete a specific candidate document from disk and database.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<any>}
 */
exports.deleteDocument = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id));
    const docId = parseInt(String(req.params.doc_id));
    const doc = await query.get('SELECT * FROM candidate_documents WHERE id = ? AND candidate_id = ?', [docId, candidateId]);
    if (!doc) return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan' });
    if (fs.existsSync(doc.file_path)) {
      try { fs.unlinkSync(doc.file_path); } catch (e) {}
    }
    await query.run('DELETE FROM candidate_documents WHERE id = ?', [docId]);
    const updatedDocs = await query.all('SELECT * FROM candidate_documents WHERE candidate_id = ? ORDER BY id DESC', [candidateId]);
    res.json({ success: true, message: 'Dokumen berhasil dihapus.', documents: updatedDocs });
  } catch (error) {
    console.error('API Error (delete document):', error);
    res.status(500).json({ success: false, message: 'Server error deleting document' });
  }
};

/**
 * Upload and save candidate document attachment to disk and database.
 * Supports multipart form uploads under 'file' key.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {void}
 */
exports.uploadDocument = (req, res) => {
  upload.single('file')(req, res, async (/** @type {any} */ err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'Ukuran file melebihi batas maksimum 5MB.' });
      return res.status(400).json({ success: false, message: err.message || 'Gagal mengunggah file.' });
    }
    try {
      const candidateId = parseInt(String(req.params.id));
      const { doc_type } = req.body;
      if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ditemukan.' });
      if (!doc_type) return res.status(400).json({ success: false, message: 'Tipe dokumen wajib diisi.' });

      const namedFolderName = await getCandidateFolderName(candidateId);
      const tempFolder = path.join(uploadsDir, `candidate_${candidateId}`);
      const namedFolder = path.join(uploadsDir, namedFolderName);
      let finalFilePath = req.file.path;

      if (namedFolder !== tempFolder && fs.existsSync(tempFolder)) {
        if (!fs.existsSync(namedFolder)) fs.renameSync(tempFolder, namedFolder);
        else {
          const newFilePath = path.join(namedFolder, req.file.filename);
          fs.renameSync(req.file.path, newFilePath);
        }
        finalFilePath = path.join(namedFolder, req.file.filename);
      }

      const existing = await query.get('SELECT id, file_path FROM candidate_documents WHERE candidate_id = ? AND doc_type = ?', [candidateId, doc_type]);
      if (existing) {
        if (fs.existsSync(existing.file_path)) { try { fs.unlinkSync(existing.file_path); } catch (e) {} }
        await query.run(
          `UPDATE candidate_documents SET file_name = ?, original_name = ?, file_path = ?, file_type = ?, file_size = ?, uploaded_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [req.file.filename, req.file.originalname, finalFilePath, req.file.mimetype, req.file.size, existing.id]
        );
      } else {
        await query.run(
          `INSERT INTO candidate_documents (candidate_id, doc_type, file_name, original_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [candidateId, doc_type, req.file.filename, req.file.originalname, finalFilePath, req.file.mimetype, req.file.size]
        );
      }
      const updatedDocs = await query.all('SELECT * FROM candidate_documents WHERE candidate_id = ? ORDER BY id DESC', [candidateId]);
      res.json({ success: true, message: 'Berkas berhasil diunggah.', documents: updatedDocs });
    } catch (error) {
      console.error('API Error (upload document):', error);
      res.status(500).json({ success: false, message: 'Server error saving uploaded file' });
    }
  });
};

/**
 * Save evaluation results for a specific recruitment stage and advance the candidate if passed.
 * Supports standard stages (1-7), onboarding (8), or custom/generic stages.
 * @param {import('express').Request} req - Express request object. Evaluation form data fields are in req.body.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<any>}
 */
exports.updateCandidateStage = async (req, res) => {
  try {
    const candidateId = parseInt(String(req.params.id));
    const stageNum = parseInt(String(req.params.stage_num));
    const data = req.body;

    const candidate = await query.get('SELECT current_stage, status FROM candidates WHERE id = ?', [candidateId]);
    if (!candidate) return res.status(404).json({ success: false, message: 'Kandidat tidak ditemukan' });

    let stage = null;
    if (stageNum !== ONBOARDING_STAGE_NUM) {
      stage = await query.get('SELECT * FROM recruitment_stages WHERE id = ?', [stageNum]);
      if (!stage) return res.status(404).json({ success: false, message: 'Tahap seleksi tidak ditemukan' });
    }

    let updatedStage = candidate.current_stage;
    let updatedStatus = candidate.status;

    if (stage && stage.code === 'admin') {
      const { berkas_lengkap, usia_sesuai, pendidikan_sesuai, skck_bersih, domisili_sesuai, phone_screen_notes, passed } = data;
      await query.run(
        `UPDATE stage1_admin SET berkas_lengkap = ?, usia_sesuai = ?, pendidikan_sesuai = ?, skck_bersih = ?, domisili_sesuai = ?, phone_screen_notes = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [berkas_lengkap ? 1 : 0, usia_sesuai ? 1 : 0, pendidikan_sesuai ? 1 : 0, skck_bersih ? 1 : 0, domisili_sesuai ? 1 : 0, phone_screen_notes, passed ? 1 : 0, candidateId]
      );
    } else if (stage && stage.code === 'written') {
      const { score_numerik, score_situasional, score_pengetahuan, score_nominal, score_kepribadian, total_score, passed } = data;
      await query.run(
        `UPDATE stage2_written_test SET score_numerik = ?, score_situasional = ?, score_pengetahuan = ?, score_nominal = ?, score_kepribadian = ?, total_score = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [score_numerik, score_situasional, score_pengetahuan, score_nominal || 0, JSON.stringify(score_kepribadian), total_score, passed ? 1 : 0, candidateId]
      );
    } else if (stage && stage.code === 'simulation') {
      const { score_upselling, score_complaint, score_queue, evaluator, notes, passed } = data;
      await query.run(
        `UPDATE stage3_simulation SET score_upselling = ?, score_complaint = ?, score_queue = ?, evaluator = ?, notes = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [score_upselling, score_complaint, score_queue, evaluator, notes, passed ? 1 : 0, candidateId]
      );
    } else if (stage && stage.code === 'interview_hrd') {
      const { score_integritas, score_pelayanan, score_ketelitian, score_belajar, score_komunikasi, score_budaya, notes, passed } = data;
      const total_weighted_score = (score_integritas * 0.25) + (score_pelayanan * 0.20) + (score_ketelitian * 0.20) + (score_belajar * 0.15) + (score_komunikasi * 0.10) + (score_budaya * 0.10);
      await query.run(
        `UPDATE stage4_interview_hrd SET score_integritas = ?, score_pelayanan = ?, score_ketelitian = ?, score_belajar = ?, score_komunikasi = ?, score_budaya = ?, total_weighted_score = ?, notes = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [score_integritas, score_pelayanan, score_ketelitian, score_belajar, score_komunikasi, score_budaya, total_weighted_score, notes, passed ? 1 : 0, candidateId]
      );
    } else if (stage && stage.code === 'interview_user') {
      const { decision, notes, passed } = data;
      await query.run(
        `UPDATE stage5_interview_user SET decision = ?, notes = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [decision, notes, passed ? 1 : 0, candidateId]
      );
    } else if (stage && stage.code === 'mcu_ref') {
      const { score_training, mcu_buta_warna, mcu_kesehatan_umum, mcu_bebas_narkoba, ref_check_verified, ref_check_notes, passed } = data;
      await query.run(
        `UPDATE stage6_mcu_ref SET score_training = ?, mcu_buta_warna = ?, mcu_kesehatan_umum = ?, mcu_bebas_narkoba = ?, ref_check_verified = ?, ref_check_notes = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [score_training || 0, mcu_buta_warna ? 1 : 0, mcu_kesehatan_umum ? 1 : 0, mcu_bebas_narkoba ? 1 : 0, ref_check_verified ? 1 : 0, ref_check_notes, passed ? 1 : 0, candidateId]
      );
    } else if (stage && stage.code === 'offering') {
      const { contract_type, salary_offered, allowance, bonus_scheme, start_date, offering_status, passed } = data;
      await query.run(
        `UPDATE stage7_offering SET contract_type = ?, salary_offered = ?, allowance = ?, bonus_scheme = ?, start_date = ?, offering_status = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [contract_type, salary_offered, allowance, bonus_scheme, start_date, offering_status, passed ? 1 : 0, candidateId]
      );
    } else if (stageNum === ONBOARDING_STAGE_NUM) {
      const { 
        day_30_status, day_30_score, day_30_notes,
        day_60_status, day_60_score, day_60_notes,
        day_90_status, day_90_score, day_90_notes,
        kpi_akurasi_transaksi, kpi_kehadiran, kpi_penguasaan_produk,
        kpi_kepuasan_pelanggan, kpi_laporan_harian, kpi_upselling
      } = data;
      await query.run(
        `UPDATE onboarding SET day_30_status = ?, day_30_score = ?, day_30_notes = ?, day_60_status = ?, day_60_score = ?, day_60_notes = ?, day_90_status = ?, day_90_score = ?, day_90_notes = ?, kpi_akurasi_transaksi = ?, kpi_kehadiran = ?, kpi_penguasaan_produk = ?, kpi_kepuasan_pelanggan = ?, kpi_laporan_harian = ?, kpi_upselling = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
        [day_30_status, day_30_score, day_30_notes, day_60_status, day_60_score, day_60_notes, day_90_status, day_90_score, day_90_notes, kpi_akurasi_transaksi, kpi_kehadiran, kpi_penguasaan_produk, kpi_kepuasan_pelanggan, kpi_laporan_harian, kpi_upselling, candidateId]
      );
    } else if (stage) {
      const { passed, notes } = data;
      const existingEval = await query.get('SELECT candidate_id FROM stage_generic_evaluations WHERE candidate_id = ? AND stage_id = ?', [candidateId, stageNum]);
      if (existingEval) {
        await query.run(
          'UPDATE stage_generic_evaluations SET passed = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ? AND stage_id = ?',
          [passed ? 1 : 0, notes, candidateId, stageNum]
        );
      } else {
        await query.run(
          'INSERT INTO stage_generic_evaluations (candidate_id, stage_id, passed, notes) VALUES (?, ?, ?, ?)',
          [candidateId, stageNum, passed ? 1 : 0, notes]
        );
      }
    }

    // Dynamic stage progression logic
    if (stage) {
      const activeStages = await query.all('SELECT * FROM recruitment_stages WHERE is_active = 1 ORDER BY order_num ASC');
      const currentIndex = activeStages.findIndex((/** @type {any} */ s) => s.id === stageNum);
      const isPassed = data.passed || 
                       (data.offering_status === 'Accepted') || 
                       (stage.code === 'offering' && data.offering_status === 'Accepted');

      if (isPassed && candidate.current_stage === stageNum) {
        if (currentIndex !== -1 && currentIndex < activeStages.length - 1) {
          updatedStage = activeStages[currentIndex + 1].id;
        } else if (currentIndex === activeStages.length - 1) {
          updatedStatus = 'Hired';
        }
      }
    }

    if (data.status === 'Rejected') updatedStatus = 'Rejected';

    await query.run('UPDATE candidates SET current_stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [updatedStage, updatedStatus, candidateId]);

    res.json({ success: true, message: `Stage ${stageNum} updated successfully`, currentStage: updatedStage, status: updatedStatus });
  } catch (error) {
    console.error('API Error (stage update):', error);
    res.status(500).json({ success: false, message: 'Server error updating stage details' });
  }
};
