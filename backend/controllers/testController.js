const { query } = require('../db');

// --- ONLINE TEST ENDPOINTS ---

exports.validateTestAccess = async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const candidate = await query.get(
      `SELECT c.id, c.name, c.current_stage, c.status, 
              t2.passed as test_passed, t2.test_completed_at as t2_completed_at,
              t6.passed as t6_passed, t6.test_completed_at as t6_completed_at
       FROM candidates c
       LEFT JOIN stage2_written_test t2 ON c.id = t2.candidate_id
       LEFT JOIN stage6_mcu_ref t6 ON c.id = t6.candidate_id
       WHERE c.access_code = ?`,
      [code]
    );

    if (!candidate) return res.json({ isValid: false, message: 'Kode Akses salah atau tidak valid.' });
    if (candidate.status === 'Rejected') return res.json({ isValid: false, message: 'Kandidat ini sudah dinyatakan tidak lolos.' });

    if (candidate.current_stage === 2) {
      if (candidate.t2_completed_at) return res.json({ isValid: false, message: 'Anda sudah menyelesaikan tes tertulis sebelumnya.' });
    } else if (candidate.current_stage === 6) {
      if (candidate.t6_completed_at) return res.json({ isValid: false, message: 'Anda sudah menyelesaikan tes pasca training sebelumnya.' });
    } else {
      return res.json({ isValid: false, message: 'Tahap Anda saat ini tidak memerlukan ujian online.' });
    }

    res.json({
      isValid: true,
      candidate: { id: candidate.id, name: candidate.name, current_stage: candidate.current_stage }
    });
  } catch (error) {
    console.error('API Error (validate code):', error);
    res.status(500).json({ success: false, message: 'Server error validating access code' });
  }
};

exports.getTestQuestions = async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const candidate = await query.get('SELECT id, current_stage, status FROM candidates WHERE access_code = ?', [code]);
    
    if (!candidate || candidate.status === 'Rejected' || (candidate.current_stage !== 2 && candidate.current_stage !== 6)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    let sql = candidate.current_stage === 2 
      ? `SELECT id, subtest, question_text, option_a, option_b, option_c, option_d, question_type, dimension, option_p, option_q FROM test_questions WHERE subtest != 'training' ORDER BY id ASC`
      : `SELECT id, subtest, question_text, option_a, option_b, option_c, option_d, question_type, dimension, option_p, option_q FROM test_questions WHERE subtest = 'training' ORDER BY id ASC`;

    const questions = await query.all(sql);
    res.json({ success: true, questions });
  } catch (error) {
    console.error('API Error (get test questions):', error);
    res.status(500).json({ success: false, message: 'Server error loading test questions' });
  }
};

exports.submitTest = async (req, res) => {
  try {
    const { code, answers } = req.body; 
    const candidate = await query.get(`SELECT id, name, current_stage FROM candidates WHERE access_code = ? AND status = 'Active'`, [code.trim().toUpperCase()]);
    
    if (!candidate) return res.status(404).json({ success: false, message: 'Kandidat tidak aktif atau tidak ditemukan.' });
    if (candidate.current_stage !== 2 && candidate.current_stage !== 6) return res.status(400).json({ success: false, message: 'Kandidat tidak sedang dalam tahap ujian.' });

    if (candidate.current_stage === 6) {
      const dbQuestions = await query.all("SELECT id, correct_option, question_type FROM test_questions WHERE subtest = 'training'");
      if (dbQuestions.length === 0) {
        await query.run(`UPDATE stage6_mcu_ref SET score_training = 100, passed = 1, test_completed_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`, [candidate.id]);
        await query.run('UPDATE candidates SET current_stage = 7, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [candidate.id]);
        return res.json({ success: true, message: 'Ujian pasca training dikirimkan (tidak ada soal, otomatis lulus).', results: { scoreTraining: 100, passed: true } });
      }

      let correctCount = 0;
      dbQuestions.forEach(q => {
        const candidateAns = answers[q.id];
        const isCorrect = q.question_type === 'essay'
          ? String(candidateAns || '').trim().toLowerCase() === String(q.correct_option || '').trim().toLowerCase()
          : candidateAns === q.correct_option;
        if (isCorrect) correctCount++;
      });

      const scoreTraining = Math.round((correctCount / dbQuestions.length) * 100);
      const passed = scoreTraining >= 65 ? 1 : 0;
      await query.run(`UPDATE stage6_mcu_ref SET score_training = ?, passed = ?, test_completed_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`, [scoreTraining, passed, candidate.id]);

      let nextStage = 6;
      let status = 'Active';
      if (passed === 1) nextStage = 7;
      else status = 'Rejected';
      
      await query.run('UPDATE candidates SET current_stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStage, status, candidate.id]);
      
      return res.json({ success: true, message: 'Ujian pasca training berhasil dikirimkan.', results: { scoreTraining, passed: passed === 1 } });
    }

    const dbQuestions = await query.all("SELECT id, subtest, question_text, correct_option, question_type, dimension FROM test_questions WHERE subtest != 'training'");
    let numerikTotal = 0, numerikCorrect = 0, situasionalTotal = 0, situasionalCorrect = 0;
    let produkTotal = 0, produkCorrect = 0, nominalTotal = 0, nominalCorrect = 0;
    const kepribadianResults = [], cognitiveDetails = [];

    dbQuestions.forEach(q => {
      const candidateAns = answers[q.id];
      const isCorrect = q.question_type === 'essay'
        ? String(candidateAns || '').trim().toLowerCase() === String(q.correct_option || '').trim().toLowerCase()
        : candidateAns === q.correct_option;

      if (!isCorrect && ['numerik', 'situasional', 'produk', 'nominal'].includes(q.subtest)) {
        cognitiveDetails.push({ subtest: q.subtest, question_text: q.question_text, candidate_answer: candidateAns || '-', correct_answer: q.correct_option });
      }

      if (q.subtest === 'numerik') { numerikTotal++; if (isCorrect) numerikCorrect++; }
      else if (q.subtest === 'situasional') { situasionalTotal++; if (isCorrect) situasionalCorrect++; }
      else if (q.subtest === 'produk') { produkTotal++; if (isCorrect) produkCorrect++; }
      else if (q.subtest === 'nominal') { nominalTotal++; if (isCorrect) nominalCorrect++; }
      else if (q.subtest === 'kepribadian') {
        kepribadianResults.push({ questionId: q.id, type: q.question_type, dimension: q.dimension, answer: candidateAns });
      }
    });

    const scoreNumerik = numerikTotal > 0 ? Math.round((numerikCorrect / numerikTotal) * 100) : 0;
    const scoreSituasional = situasionalTotal > 0 ? Math.round((situasionalCorrect / situasionalTotal) * 100) : 0;
    const scorePengetahuan = produkTotal > 0 ? Math.round((produkCorrect / produkTotal) * 100) : 0;
    const scoreNominal = nominalTotal > 0 ? Math.round((nominalCorrect / nominalTotal) * 100) : 0;

    let activeSubtests = 0, totalCognitiveScoreSum = 0;
    if (numerikTotal > 0) { activeSubtests++; totalCognitiveScoreSum += scoreNumerik; }
    if (situasionalTotal > 0) { activeSubtests++; totalCognitiveScoreSum += scoreSituasional; }
    if (produkTotal > 0) { activeSubtests++; totalCognitiveScoreSum += scorePengetahuan; }
    if (nominalTotal > 0) { activeSubtests++; totalCognitiveScoreSum += scoreNominal; }

    const totalScore = activeSubtests > 0 ? Math.round(totalCognitiveScoreSum / activeSubtests) : 0;
    const passed = totalScore >= 65 ? 1 : 0;
    
    await query.run(
      `UPDATE stage2_written_test SET score_numerik = ?, score_situasional = ?, score_pengetahuan = ?, score_nominal = ?, score_kepribadian = ?, cognitive_details = ?, total_score = ?, passed = ?, test_completed_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`,
      [scoreNumerik, scoreSituasional, scorePengetahuan, scoreNominal, JSON.stringify(kepribadianResults), JSON.stringify(cognitiveDetails), totalScore, passed, candidate.id]
    );

    let nextStage = 2, status = 'Active';
    if (passed === 1) nextStage = 3; else status = 'Rejected';
    await query.run('UPDATE candidates SET current_stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStage, status, candidate.id]);

    res.json({ success: true, message: 'Ujian berhasil dikirimkan.', results: { scoreNumerik, scoreSituasional, scorePengetahuan, totalScore, passed: passed === 1 } });
  } catch (error) {
    console.error('API Error (submit test):', error);
    res.status(500).json({ success: false, message: 'Server error processing test submission' });
  }
};

// --- ADMIN QUESTION CRUD ---
exports.getAdminQuestions = async (req, res) => {
  try {
    const questions = await query.all('SELECT * FROM test_questions ORDER BY id ASC');
    res.json({ success: true, questions });
  } catch (error) {
    console.error('API Error (admin get questions):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving questions' });
  }
};

exports.addAdminQuestion = async (req, res) => {
  try {
    const { subtest, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, dimension, option_p, option_q } = req.body;
    if (!subtest || !question_text || !question_type) return res.status(400).json({ success: false, message: 'Subtest, teks soal, dan tipe soal wajib diisi' });

    const sql = `INSERT INTO test_questions (subtest, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, dimension, option_p, option_q) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await query.run(sql, [subtest, question_text, option_a || null, option_b || null, option_c || null, option_d || null, correct_option || null, question_type, dimension || null, option_p || null, option_q || null]);
    res.status(201).json({ success: true, message: 'Soal baru berhasil ditambahkan', questionId: result.id });
  } catch (error) {
    console.error('API Error (admin add question):', error);
    res.status(500).json({ success: false, message: 'Server error saving question' });
  }
};

exports.updateAdminQuestion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { subtest, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, dimension, option_p, option_q } = req.body;
    const existing = await query.get('SELECT id FROM test_questions WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Soal tidak ditemukan' });

    const sql = `UPDATE test_questions SET subtest = ?, question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, question_type = ?, dimension = ?, option_p = ?, option_q = ? WHERE id = ?`;
    await query.run(sql, [subtest, question_text, option_a || null, option_b || null, option_c || null, option_d || null, correct_option || null, question_type, dimension || null, option_p || null, option_q || null, id]);
    res.json({ success: true, message: 'Soal berhasil diperbarui' });
  } catch (error) {
    console.error('API Error (admin update question):', error);
    res.status(500).json({ success: false, message: 'Server error updating question' });
  }
};

exports.deleteAdminQuestion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await query.get('SELECT id FROM test_questions WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Soal tidak ditemukan' });
    await query.run('DELETE FROM test_questions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Soal berhasil dihapus' });
  } catch (error) {
    console.error('API Error (admin delete question):', error);
    res.status(500).json({ success: false, message: 'Server error deleting question' });
  }
};

// --- TRAINING QUESTIONS ---
exports.getTrainingQuestions = async (req, res) => {
  try {
    const questions = await query.all('SELECT * FROM training_questions ORDER BY order_num ASC, id ASC');
    res.json({ success: true, questions });
  } catch (error) {
    console.error('API Error (get training questions):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving training questions' });
  }
};

exports.addTrainingQuestion = async (req, res) => {
  try {
    const { statement_text } = req.body;
    if (!statement_text) return res.status(400).json({ success: false, message: 'Teks pernyataan wajib diisi' });
    const orderResult = await query.get('SELECT MAX(order_num) as max_order FROM training_questions');
    const nextOrder = (orderResult.max_order || 0) + 1;
    const result = await query.run('INSERT INTO training_questions (statement_text, order_num) VALUES (?, ?)', [statement_text, nextOrder]);
    res.status(201).json({ success: true, message: 'Pernyataan training baru berhasil ditambahkan', questionId: result.id });
  } catch (error) {
    console.error('API Error (add training question):', error);
    res.status(500).json({ success: false, message: 'Server error saving training statement' });
  }
};

exports.updateTrainingQuestion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { statement_text } = req.body;
    const existing = await query.get('SELECT id FROM training_questions WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Pernyataan tidak ditemukan' });
    await query.run('UPDATE training_questions SET statement_text = ? WHERE id = ?', [statement_text, id]);
    res.json({ success: true, message: 'Pernyataan berhasil diperbarui' });
  } catch (error) {
    console.error('API Error (update training question):', error);
    res.status(500).json({ success: false, message: 'Server error updating training statement' });
  }
};

exports.deleteTrainingQuestion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await query.get('SELECT id FROM training_questions WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Pernyataan tidak ditemukan' });
    await query.run('DELETE FROM training_questions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pernyataan berhasil dihapus' });
  } catch (error) {
    console.error('API Error (delete training question):', error);
    res.status(500).json({ success: false, message: 'Server error deleting training statement' });
  }
};

// --- TRAINING TEST PORTAL ---
exports.validateTrainingTest = async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const candidate = await query.get(`SELECT c.id, c.name, c.current_stage, c.status, t6.passed, t6.test_completed_at FROM candidates c LEFT JOIN stage6_mcu_ref t6 ON c.id = t6.candidate_id WHERE c.access_code = ?`, [code]);
    if (!candidate) return res.json({ isValid: false, message: 'Kode akses salah atau tidak valid.' });
    if (candidate.status === 'Rejected') return res.json({ isValid: false, message: 'Kandidat ini sudah dinyatakan tidak lolos.' });
    if (candidate.current_stage !== 6) return res.json({ isValid: false, message: 'Kandidat tidak sedang dalam Tahap 6 (Training).' });
    if (candidate.test_completed_at) return res.json({ isValid: false, message: 'Evaluasi training untuk kandidat ini sudah pernah dikirim.' });
    
    const statements = await query.all('SELECT * FROM training_questions ORDER BY order_num ASC, id ASC');
    res.json({ isValid: true, candidate: { id: candidate.id, name: candidate.name, current_stage: candidate.current_stage }, statements });
  } catch (error) {
    console.error('API Error (validate training code):', error);
    res.status(500).json({ success: false, message: 'Server error validating training access code' });
  }
};

exports.submitTrainingTest = async (req, res) => {
  try {
    const { code, ratings, notes } = req.body;
    const candidate = await query.get(`SELECT id, name, current_stage FROM candidates WHERE access_code = ? AND status = 'Active'`, [code.trim().toUpperCase()]);
    if (!candidate) return res.status(404).json({ success: false, message: 'Kandidat tidak aktif atau tidak ditemukan.' });
    if (candidate.current_stage !== 6) return res.status(400).json({ success: false, message: 'Kandidat tidak sedang dalam Tahap 6 (Training).' });

    const dbStatements = await query.all('SELECT id FROM training_questions');
    if (dbStatements.length === 0) return res.status(400).json({ success: false, message: 'Belum ada indikator pernyataan training di bank soal.' });

    let sum = 0;
    dbStatements.forEach(stmt => { sum += parseInt(ratings[stmt.id]) || 0; });
    const averageScore = parseFloat((sum / dbStatements.length).toFixed(2));
    const passed = averageScore >= 6.5 ? 1 : 0;
    const scoreTrainingPercentage = Math.round((averageScore / 10) * 100);

    await query.run(`UPDATE stage6_mcu_ref SET score_training = ?, passed = ?, test_completed_at = CURRENT_TIMESTAMP, training_details = ? WHERE candidate_id = ?`, [scoreTrainingPercentage, passed, JSON.stringify(ratings), candidate.id]);

    let nextStage = 6, status = 'Active';
    if (passed === 1) nextStage = 7; else status = 'Rejected';
    await query.run('UPDATE candidates SET current_stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStage, status, candidate.id]);

    res.json({ success: true, message: 'Evaluasi training berhasil disimpan.', results: { averageScore, passed: passed === 1 } });
  } catch (error) {
    console.error('API Error (submit training):', error);
    res.status(500).json({ success: false, message: 'Server error processing training submission' });
  }
};
