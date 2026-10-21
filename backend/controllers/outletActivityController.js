const { query } = require('../db');
const { outletPhotosDir } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

// Helper to format Indonesian date (e.g., "Rabu, 21 Oktober 2026")
function formatIndonesianDate(dateStr) {
  try {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const dayName = days[d.getDay()];
    const dateNum = d.getDate();
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  } catch (e) {
    return dateStr;
  }
}

// Get today's local date string YYYY-MM-DD
function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 1. GET /api/outlet-activity/summary
 * Returns daily executive summary, metrics, visits list, incidents, and ready-to-copy WhatsApp report text.
 */
exports.getDailySummary = async (req, res) => {
  try {
    const date = (req.query.date || getTodayDateStr()).trim();
    const formattedDate = formatIndonesianDate(date);

    // Fetch visits for this date
    const visits = await query.all(
      `SELECT v.*, b.name as branch_name, b.code as branch_code, b.city as branch_city, b.address as branch_address
       FROM outlet_visits v
       JOIN branches b ON v.branch_id = b.id
       WHERE v.visit_date = ?
       ORDER BY v.visit_time ASC, v.id ASC`,
      [date]
    );

    // Parse photos and checklist_data for each visit
    const parsedVisits = visits.map(v => ({
      ...v,
      photos: v.photos ? JSON.parse(v.photos) : [],
      checklist_data: v.checklist_data ? JSON.parse(v.checklist_data) : {}
    }));

    // Fetch incidents on this date
    const incidents = await query.all(
      `SELECT i.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
       FROM outlet_incidents i
       JOIN branches b ON i.branch_id = b.id
       WHERE i.incident_date = ?
       ORDER BY i.severity DESC, i.id DESC`,
      [date]
    );

    const parsedIncidents = incidents.map(i => ({
      ...i,
      photos: i.photos ? JSON.parse(i.photos) : []
    }));

    // Fetch active action items (pending/in-progress) across all branches
    const activeActionItems = await query.all(
      `SELECT a.*, b.name as branch_name, b.code as branch_code
       FROM outlet_action_items a
       JOIN branches b ON a.branch_id = b.id
       WHERE a.status != 'Done'
       ORDER BY CASE a.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, a.due_date ASC
       LIMIT 10`
    );

    // Calculate metrics
    const totalVisits = parsedVisits.length;
    const completedVisits = parsedVisits.filter(v => v.status === 'Completed').length;
    const plannedVisits = parsedVisits.filter(v => v.status === 'Planned').length;

    const scoredVisits = parsedVisits.filter(v => v.overall_score > 0);
    const avgScore = scoredVisits.length > 0
      ? Math.round(scoredVisits.reduce((acc, curr) => acc + curr.overall_score, 0) / scoredVisits.length)
      : 0;

    const totalIncidents = parsedIncidents.length;
    const criticalIncidents = parsedIncidents.filter(i => i.severity === 'Critical' || i.severity === 'High').length;

    // Unique visitors list
    const visitorsList = [...new Set(parsedVisits.map(v => v.visitor_name).filter(Boolean))];
    const visitorHeader = visitorsList.length > 0 ? visitorsList.join(', ') : (req.user?.username || 'Tim HR/GA');

    // Generate formatted WhatsApp Report
    let waText = `📋 *LAPORAN HARIAN HR/GA & OUTLET VISIT*\n`;
    waText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `🗓 *Hari/Tanggal :* ${formattedDate}\n`;
    waText += `👤 *Petugas        :* ${visitorHeader}\n`;
    waText += `📍 *Total Visit    :* ${totalVisits} Cabang\n`;
    if (avgScore > 0) {
      waText += `⭐ *Rata-rata Skor :* ${avgScore}/100\n`;
    }
    waText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (parsedVisits.length === 0) {
      waText += `_Belum ada kunjungan yang dicatat untuk tanggal ini._\n\n`;
    } else {
      parsedVisits.forEach((v, idx) => {
        waText += `📍 *${idx + 1}. ${v.branch_name.toUpperCase()} (${v.branch_code})*\n`;
        if (v.visit_time) waText += `• *Waktu :* ${v.visit_time} WIB\n`;
        waText += `• *Fokus :* ${v.purpose}\n`;
        if (v.overall_score > 0) {
          waText += `• *Skor Audit :* ${v.overall_score}/100\n`;
        }
        waText += `• *Temuan/Catatan :* ${v.notes || 'Kondisi operasional normal dan aman.'}\n`;
        if (v.action_plan && v.action_plan.trim() !== '') {
          waText += `• *Tindakan/Rencana :* ${v.action_plan}\n`;
        }
        waText += `\n`;
      });
    }

    if (parsedIncidents.length > 0) {
      waText += `🚨 *KEJADIAN / INSIDEN HARI INI (${parsedIncidents.length}):*\n`;
      parsedIncidents.forEach((inc, i) => {
        waText += `${i + 1}. [${inc.branch_name}] *${inc.category}* (${inc.severity}): ${inc.title}\n`;
        if (inc.action_taken) {
          waText += `   ↳ _Tindakan:_ ${inc.action_taken}\n`;
        }
      });
      waText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    if (activeActionItems.length > 0) {
      waText += `📌 *PR / TINDAK LANJUT PRIORITAS:*\n`;
      activeActionItems.slice(0, 5).forEach((a, i) => {
        waText += `${i + 1}. [${a.branch_name}] ${a.task_description}`;
        if (a.assigned_to) waText += ` (PIC: ${a.assigned_to})`;
        if (a.due_date) waText += ` - Target: ${a.due_date}`;
        waText += `\n`;
      });
      waText += `\n`;
    }

    waText += `_Dibuat otomatis melalui Sistem HRMv2_`;

    res.json({
      success: true,
      data: {
        date,
        formattedDate,
        metrics: {
          totalVisits,
          completedVisits,
          plannedVisits,
          avgScore,
          totalIncidents,
          criticalIncidents,
          openActionItemsCount: activeActionItems.length
        },
        visits: parsedVisits,
        incidents: parsedIncidents,
        activeActionItems,
        whatsappText: waText
      }
    });
  } catch (error) {
    console.error('API Error (getDailySummary):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat ringkasan harian aktivitas outlet.' });
  }
};

/**
 * 2. GET /api/outlet-activity/visits
 * List visits with optional filters (branch_id, date, month, status)
 */
exports.getVisits = async (req, res) => {
  try {
    const { branch_id, date, month, status, limit, offset } = req.query;
    let sql = `
      SELECT v.*, b.name as branch_name, b.code as branch_code, b.city as branch_city, b.address as branch_address
      FROM outlet_visits v
      JOIN branches b ON v.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND v.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (date) {
      sql += ' AND v.visit_date = ?';
      params.push(date);
    }
    if (month) {
      sql += ' AND v.visit_date LIKE ?';
      params.push(`${month}%`);
    }
    if (status) {
      sql += ' AND v.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY v.visit_date DESC, v.visit_time DESC, v.id DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit, 10));
      if (offset) {
        sql += ' OFFSET ?';
        params.push(parseInt(offset, 10));
      }
    }

    const rows = await query.all(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : [],
      checklist_data: r.checklist_data ? JSON.parse(r.checklist_data) : {}
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('API Error (getVisits):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar kunjungan outlet.' });
  }
};

/**
 * 3. GET /api/outlet-activity/visits/:id
 * Visit details with linked incidents and action items.
 */
exports.getVisitDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const visit = await query.get(
      `SELECT v.*, b.name as branch_name, b.code as branch_code, b.city as branch_city, b.address as branch_address
       FROM outlet_visits v
       JOIN branches b ON v.branch_id = b.id
       WHERE v.id = ?`,
      [id]
    );

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Data kunjungan tidak ditemukan.' });
    }

    const incidents = await query.all(
      'SELECT * FROM outlet_incidents WHERE visit_id = ? ORDER BY id DESC',
      [id]
    );

    const actionItems = await query.all(
      'SELECT * FROM outlet_action_items WHERE visit_id = ? ORDER BY id DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...visit,
        photos: visit.photos ? JSON.parse(visit.photos) : [],
        checklist_data: visit.checklist_data ? JSON.parse(visit.checklist_data) : {},
        incidents: incidents.map(i => ({ ...i, photos: i.photos ? JSON.parse(i.photos) : [] })),
        action_items: actionItems
      }
    });
  } catch (error) {
    console.error('API Error (getVisitDetail):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat detail kunjungan.' });
  }
};

/**
 * 4. POST /api/outlet-activity/visits
 * Create new visit log (supports multipart/form-data for photos).
 */
exports.createVisit = async (req, res) => {
  try {
    const {
      branch_id,
      visit_date,
      visit_time,
      visitor_name,
      purpose,
      status,
      score_cleanliness,
      score_security,
      score_display,
      score_sop,
      checklist_data,
      notes,
      action_plan,
      staff_present
    } = req.body;

    if (!branch_id || !visit_date || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Cabang outlet, tanggal kunjungan, dan tujuan kunjungan wajib diisi.'
      });
    }

    // Calculate overall score if subscores are provided
    const scores = [
      parseInt(score_cleanliness, 10),
      parseInt(score_security, 10),
      parseInt(score_display, 10),
      parseInt(score_sop, 10)
    ].filter(s => !isNaN(s) && s > 0);

    const overallScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : (parseInt(req.body.overall_score, 10) || 0);

    // Photos handling from multer
    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    } else if (req.body.existing_photos) {
      try {
        photosList = Array.isArray(req.body.existing_photos)
          ? req.body.existing_photos
          : JSON.parse(req.body.existing_photos);
      } catch (e) {}
    }

    const visitor = visitor_name?.trim() || req.user?.username || 'Tim HR/GA';

    const insertSql = `
      INSERT INTO outlet_visits (
        branch_id, visit_date, visit_time, visitor_name, purpose, status,
        score_cleanliness, score_security, score_display, score_sop, overall_score,
        checklist_data, notes, action_plan, staff_present, photos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query.run(insertSql, [
      parseInt(branch_id, 10),
      visit_date,
      visit_time || null,
      visitor,
      purpose,
      status || 'Completed',
      parseInt(score_cleanliness, 10) || 0,
      parseInt(score_security, 10) || 0,
      parseInt(score_display, 10) || 0,
      parseInt(score_sop, 10) || 0,
      overallScore,
      typeof checklist_data === 'object' ? JSON.stringify(checklist_data) : (checklist_data || null),
      notes || null,
      action_plan || null,
      staff_present || null,
      JSON.stringify(photosList)
    ]);

    const createdId = result.id;

    res.status(201).json({
      success: true,
      message: 'Kunjungan outlet berhasil dicatat.',
      id: createdId
    });
  } catch (error) {
    console.error('API Error (createVisit):', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan data kunjungan outlet.' });
  }
};

/**
 * 5. PUT /api/outlet-activity/visits/:id
 */
exports.updateVisit = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_visits WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Kunjungan tidak ditemukan.' });
    }

    const {
      branch_id,
      visit_date,
      visit_time,
      visitor_name,
      purpose,
      status,
      score_cleanliness,
      score_security,
      score_display,
      score_sop,
      checklist_data,
      notes,
      action_plan,
      staff_present
    } = req.body;

    const scores = [
      parseInt(score_cleanliness ?? existing.score_cleanliness, 10),
      parseInt(score_security ?? existing.score_security, 10),
      parseInt(score_display ?? existing.score_display, 10),
      parseInt(score_sop ?? existing.score_sop, 10)
    ].filter(s => !isNaN(s) && s > 0);

    const overallScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : (parseInt(req.body.overall_score ?? existing.overall_score, 10) || 0);

    // Photos: keep existing and add new if uploaded
    let currentPhotos = existing.photos ? JSON.parse(existing.photos) : [];
    if (req.body.delete_photos) {
      const toDelete = Array.isArray(req.body.delete_photos) ? req.body.delete_photos : [req.body.delete_photos];
      currentPhotos = currentPhotos.filter(p => !toDelete.includes(p));
    }
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newFiles = req.files.map(f => f.filename);
      currentPhotos = [...currentPhotos, ...newFiles];
    }

    const updateSql = `
      UPDATE outlet_visits
      SET branch_id = ?, visit_date = ?, visit_time = ?, visitor_name = ?, purpose = ?, status = ?,
          score_cleanliness = ?, score_security = ?, score_display = ?, score_sop = ?, overall_score = ?,
          checklist_data = ?, notes = ?, action_plan = ?, staff_present = ?, photos = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await query.run(updateSql, [
      parseInt(branch_id ?? existing.branch_id, 10),
      visit_date ?? existing.visit_date,
      visit_time ?? existing.visit_time,
      visitor_name ?? existing.visitor_name,
      purpose ?? existing.purpose,
      status ?? existing.status,
      parseInt(score_cleanliness ?? existing.score_cleanliness, 10) || 0,
      parseInt(score_security ?? existing.score_security, 10) || 0,
      parseInt(score_display ?? existing.score_display, 10) || 0,
      parseInt(score_sop ?? existing.score_sop, 10) || 0,
      overallScore,
      checklist_data !== undefined
        ? (typeof checklist_data === 'object' ? JSON.stringify(checklist_data) : checklist_data)
        : existing.checklist_data,
      notes ?? existing.notes,
      action_plan ?? existing.action_plan,
      staff_present ?? existing.staff_present,
      JSON.stringify(currentPhotos),
      id
    ]);

    res.json({ success: true, message: 'Data kunjungan berhasil diperbarui.' });
  } catch (error) {
    console.error('API Error (updateVisit):', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data kunjungan.' });
  }
};

/**
 * 6. DELETE /api/outlet-activity/visits/:id
 */
exports.deleteVisit = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_visits WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data kunjungan tidak ditemukan.' });
    }

    // Delete photo files
    if (existing.photos) {
      try {
        const photoArr = JSON.parse(existing.photos);
        photoArr.forEach(p => {
          const filePath = path.join(outletPhotosDir, p);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        });
      } catch (e) {}
    }

    await query.run('DELETE FROM outlet_visits WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data kunjungan berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (deleteVisit):', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data kunjungan.' });
  }
};

/**
 * 7. GET /api/outlet-activity/incidents
 */
exports.getIncidents = async (req, res) => {
  try {
    const { branch_id, status, category, date } = req.query;
    let sql = `
      SELECT i.*, b.name as branch_name, b.code as branch_code, b.city as branch_city,
             e.name as linked_employee_name
      FROM outlet_incidents i
      JOIN branches b ON i.branch_id = b.id
      LEFT JOIN employees e ON i.linked_employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND i.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND i.category = ?';
      params.push(category);
    }
    if (date) {
      sql += ' AND i.incident_date = ?';
      params.push(date);
    }

    sql += ' ORDER BY i.incident_date DESC, i.id DESC';

    const rows = await query.all(sql, params);
    const parsed = rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : []
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('API Error (getIncidents):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat log kejadian outlet.' });
  }
};

/**
 * 8. POST /api/outlet-activity/incidents
 */
exports.createIncident = async (req, res) => {
  try {
    const {
      branch_id,
      visit_id,
      incident_date,
      category,
      severity,
      title,
      description,
      action_taken,
      status,
      reported_by,
      linked_employee_id
    } = req.body;

    if (!branch_id || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Cabang outlet, judul kejadian, dan deskripsi wajib diisi.'
      });
    }

    let photosList = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      photosList = req.files.map(f => f.filename);
    }

    const reporter = reported_by?.trim() || req.user?.username || 'Tim HR/GA';
    const date = incident_date || getTodayDateStr();

    const insertSql = `
      INSERT INTO outlet_incidents (
        branch_id, visit_id, incident_date, category, severity, title,
        description, action_taken, status, reported_by, linked_employee_id, photos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query.run(insertSql, [
      parseInt(branch_id, 10),
      visit_id ? parseInt(visit_id, 10) : null,
      date,
      category || 'Operasional & Kasir',
      severity || 'Medium',
      title,
      description,
      action_taken || null,
      status || 'Open',
      reporter,
      linked_employee_id ? parseInt(linked_employee_id, 10) : null,
      JSON.stringify(photosList)
    ]);

    res.status(201).json({
      success: true,
      message: 'Kejadian outlet berhasil dicatat.',
      id: result.id
    });
  } catch (error) {
    console.error('API Error (createIncident):', error);
    res.status(500).json({ success: false, message: 'Gagal mencatat kejadian outlet.' });
  }
};

/**
 * 9. PUT /api/outlet-activity/incidents/:id
 */
exports.updateIncident = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await query.get('SELECT * FROM outlet_incidents WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data kejadian tidak ditemukan.' });
    }

    const {
      branch_id,
      category,
      severity,
      title,
      description,
      action_taken,
      status,
      resolved_date,
      linked_employee_id
    } = req.body;

    let currentPhotos = existing.photos ? JSON.parse(existing.photos) : [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newFiles = req.files.map(f => f.filename);
      currentPhotos = [...currentPhotos, ...newFiles];
    }

    const resolved = status === 'Resolved' ? (resolved_date || getTodayDateStr()) : null;

    const updateSql = `
      UPDATE outlet_incidents
      SET branch_id = ?, category = ?, severity = ?, title = ?, description = ?,
          action_taken = ?, status = ?, resolved_date = ?, linked_employee_id = ?,
          photos = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await query.run(updateSql, [
      parseInt(branch_id ?? existing.branch_id, 10),
      category ?? existing.category,
      severity ?? existing.severity,
      title ?? existing.title,
      description ?? existing.description,
      action_taken ?? existing.action_taken,
      status ?? existing.status,
      resolved,
      linked_employee_id !== undefined ? (linked_employee_id ? parseInt(linked_employee_id, 10) : null) : existing.linked_employee_id,
      JSON.stringify(currentPhotos),
      id
    ]);

    res.json({ success: true, message: 'Data kejadian berhasil diperbarui.' });
  } catch (error) {
    console.error('API Error (updateIncident):', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui kejadian.' });
  }
};

/**
 * 10. DELETE /api/outlet-activity/incidents/:id
 */
exports.deleteIncident = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query.run('DELETE FROM outlet_incidents WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data kejadian berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (deleteIncident):', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data kejadian.' });
  }
};

/**
 * 11. GET /api/outlet-activity/action-items
 */
exports.getActionItems = async (req, res) => {
  try {
    const { branch_id, status } = req.query;
    let sql = `
      SELECT a.*, b.name as branch_name, b.code as branch_code
      FROM outlet_action_items a
      JOIN branches b ON a.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      sql += ' AND a.branch_id = ?';
      params.push(parseInt(branch_id, 10));
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += " ORDER BY CASE a.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, a.due_date ASC, a.id DESC";

    const rows = await query.all(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('API Error (getActionItems):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar tindak lanjut.' });
  }
};

/**
 * 12. POST /api/outlet-activity/action-items
 */
exports.createActionItem = async (req, res) => {
  try {
    const { branch_id, visit_id, incident_id, task_description, assigned_to, due_date, priority } = req.body;
    if (!branch_id || !task_description) {
      return res.status(400).json({ success: false, message: 'Cabang dan deskripsi tugas wajib diisi.' });
    }

    const insertSql = `
      INSERT INTO outlet_action_items (
        branch_id, visit_id, incident_id, task_description, assigned_to, due_date, priority, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
    `;

    const result = await query.run(insertSql, [
      parseInt(branch_id, 10),
      visit_id ? parseInt(visit_id, 10) : null,
      incident_id ? parseInt(incident_id, 10) : null,
      task_description,
      assigned_to || null,
      due_date || null,
      priority || 'Medium'
    ]);

    res.status(201).json({ success: true, message: 'Tindak lanjut (PR) berhasil ditambahkan.', id: result.id });
  } catch (error) {
    console.error('API Error (createActionItem):', error);
    res.status(500).json({ success: false, message: 'Gagal menambahkan tindak lanjut.' });
  }
};

/**
 * 13. PUT /api/outlet-activity/action-items/:id
 */
exports.updateActionItem = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { task_description, assigned_to, due_date, priority, status, completion_notes } = req.body;

    const existing = await query.get('SELECT * FROM outlet_action_items WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data tindak lanjut tidak ditemukan.' });
    }

    const updateSql = `
      UPDATE outlet_action_items
      SET task_description = ?, assigned_to = ?, due_date = ?, priority = ?,
          status = ?, completion_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await query.run(updateSql, [
      task_description ?? existing.task_description,
      assigned_to ?? existing.assigned_to,
      due_date ?? existing.due_date,
      priority ?? existing.priority,
      status ?? existing.status,
      completion_notes ?? existing.completion_notes,
      id
    ]);

    res.json({ success: true, message: 'Status tindak lanjut berhasil diperbarui.' });
  } catch (error) {
    console.error('API Error (updateActionItem):', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui tindak lanjut.' });
  }
};

/**
 * 14. DELETE /api/outlet-activity/action-items/:id
 */
exports.deleteActionItem = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query.run('DELETE FROM outlet_action_items WHERE id = ?', [id]);
    res.json({ success: true, message: 'Tindak lanjut berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (deleteActionItem):', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus tindak lanjut.' });
  }
};

/**
 * 15. GET /api/outlet-activity/branches/:id/history
 * Comprehensive branch activity profile: all visits, incidents, and PR for a specific branch.
 */
exports.getBranchHistory = async (req, res) => {
  try {
    const branchId = parseInt(req.params.id, 10);
    const branch = await query.get('SELECT * FROM branches WHERE id = ?', [branchId]);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan.' });
    }

    const visits = await query.all(
      'SELECT * FROM outlet_visits WHERE branch_id = ? ORDER BY visit_date DESC, id DESC LIMIT 50',
      [branchId]
    );

    const incidents = await query.all(
      'SELECT * FROM outlet_incidents WHERE branch_id = ? ORDER BY incident_date DESC, id DESC LIMIT 50',
      [branchId]
    );

    const actionItems = await query.all(
      "SELECT * FROM outlet_action_items WHERE branch_id = ? ORDER BY CASE status WHEN 'Pending' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END, id DESC",
      [branchId]
    );

    // Calculate branch statistics
    const totalVisits = visits.length;
    const scoredVisits = visits.filter(v => v.overall_score > 0);
    const avgScore = scoredVisits.length > 0
      ? Math.round(scoredVisits.reduce((acc, curr) => acc + curr.overall_score, 0) / scoredVisits.length)
      : 0;

    const lastVisit = visits[0] || null;
    const openIncidents = incidents.filter(i => i.status !== 'Resolved').length;
    const pendingActions = actionItems.filter(a => a.status !== 'Done').length;

    res.json({
      success: true,
      data: {
        branch,
        stats: {
          totalVisits,
          avgScore,
          lastVisitDate: lastVisit ? lastVisit.visit_date : null,
          openIncidents,
          pendingActions
        },
        visits: visits.map(v => ({ ...v, photos: v.photos ? JSON.parse(v.photos) : [] })),
        incidents: incidents.map(i => ({ ...i, photos: i.photos ? JSON.parse(i.photos) : [] })),
        action_items: actionItems
      }
    });
  } catch (error) {
    console.error('API Error (getBranchHistory):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat rekam jejak cabang.' });
  }
};

/**
 * 16. GET /api/outlet-activity/photos/:filename
 * Safely stream an audit/visit photo file from ZimaOS storage.
 */
exports.servePhoto = (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(outletPhotosDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Foto tidak ditemukan.' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('API Error (servePhoto):', error);
    res.status(500).json({ success: false, message: 'Gagal memuat file foto.' });
  }
};
