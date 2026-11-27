const { query } = require('../db');

exports.getStats = async (req, res) => {
  try {
    const totalCandidates = await query.get('SELECT COUNT(*) as count FROM candidates');
    const hiredCandidates = await query.get("SELECT COUNT(*) as count FROM candidates WHERE status = 'Hired'");
    const rejectedCandidates = await query.get("SELECT COUNT(*) as count FROM candidates WHERE status = 'Rejected'");
    const activeCandidates = await query.get("SELECT COUNT(*) as count FROM candidates WHERE status = 'Active'");
    
    // Count per stage
    const stageCounts = await query.all(`
      SELECT current_stage, COUNT(*) as count 
      FROM candidates 
      WHERE status = 'Active' 
      GROUP BY current_stage
    `);

    // Complete pipeline stats
    const stages = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    stageCounts.forEach(row => {
      stages[row.current_stage] = row.count;
    });

    res.json({
      success: true,
      stats: {
        total: totalCandidates.count,
        hired: hiredCandidates.count,
        rejected: rejectedCandidates.count,
        active: activeCandidates.count,
        stages
      }
    });
  } catch (error) {
    console.error('API Error (stats):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving statistics' });
  }
};

exports.getMasterSummary = async (req, res) => {
  try {
    // 1. Employee stats
    const empTotal = await query.get("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'");
    const empFrontliner = await query.get("SELECT COUNT(*) as count FROM employees WHERE status = 'Active' AND employee_type = 'Frontliner'");
    const empStaff = await query.get("SELECT COUNT(*) as count FROM employees WHERE status = 'Active' AND employee_type = 'Staff'");
    const empResign = await query.get("SELECT COUNT(*) as count FROM employees WHERE status = 'Resign'");
    const empTerminated = await query.get("SELECT COUNT(*) as count FROM employees WHERE status = 'Terminated'");
    
    // Contract types breakdown
    const contractStats = await query.all(`
      SELECT contract_type, COUNT(*) as count
      FROM employees
      WHERE status = 'Active'
      GROUP BY contract_type
    `);

    // Pending promotion from candidates
    const pendingPromotion = await query.get(`
      SELECT COUNT(*) as count 
      FROM candidates c 
      WHERE c.status = 'Hired' AND c.id NOT IN (SELECT candidate_id FROM employees WHERE candidate_id IS NOT NULL)
    `);

    // Recent 6 active employees
    const recentEmployees = await query.all(`
      SELECT e.id, e.name, e.position, e.employee_type, e.contract_type, e.hire_date, b.name as branch_name, b.code as branch_code
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.status = 'Active'
      ORDER BY e.id DESC
      LIMIT 6
    `);

    // 2. Branch stats
    const branchTotal = await query.get("SELECT COUNT(*) as count FROM branches WHERE status = 'Active'");
    const branchKonter = await query.get("SELECT COUNT(*) as count FROM branches WHERE status = 'Active' AND location_type = 'Konter'");
    const branchGudang = await query.get("SELECT COUNT(*) as count FROM branches WHERE status = 'Active' AND location_type = 'Gudang'");
    const branchKantor = await query.get("SELECT COUNT(*) as count FROM branches WHERE status = 'Active' AND location_type = 'Kantor/Pusat'");
    const branchPetshop = await query.get("SELECT COUNT(*) as count FROM branches WHERE status = 'Active' AND has_petshop = 1");
    const totalRent = await query.get("SELECT COALESCE(SUM(rent_amount), 0) as total FROM branches WHERE status = 'Active'");

    // Branches with employee count
    const branchList = await query.all(`
      SELECT b.id, b.code, b.name, b.city, b.location_type, b.has_petshop, b.rent_amount,
             (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.status = 'Active') AS staff_count
      FROM branches b
      WHERE b.status = 'Active'
      ORDER BY staff_count DESC, b.name ASC
    `);

    // 3. System settings
    const settingsRows = await query.all('SELECT key, value FROM system_settings');
    const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

    // Late penalty rules
    const lateRules = await query.all('SELECT * FROM late_penalty_rules ORDER BY min_count ASC');

    // 4. Contract & Probation Expiry Alerts
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const reminderDays = Math.max(1, parseInt(settings.contract_reminder_days, 10) || 30);
    const cutoffDt = new Date(`${todayStr}T00:00:00Z`);
    cutoffDt.setUTCDate(cutoffDt.getUTCDate() + reminderDays);
    const cutoffStr = cutoffDt.toISOString().slice(0, 10);

    const expRows = await query.all(
      `SELECT e.id, e.name, e.position, e.contract_type, e.contract_end, e.probation_end, b.name AS branch_name
       FROM employees e LEFT JOIN branches b ON e.branch_id = b.id
       WHERE e.status = 'Active'
         AND ((e.contract_end IS NOT NULL AND e.contract_end != '' AND e.contract_end <= ?)
           OR (e.probation_end IS NOT NULL AND e.probation_end != '' AND e.probation_end <= ?))`,
      [cutoffStr, cutoffStr]
    );
    const contractAlerts = [];
    const baseMs = new Date(`${todayStr}T00:00:00Z`).getTime();
    for (const r of expRows) {
      if (r.contract_end && r.contract_end <= cutoffStr) {
        const ms = new Date(`${String(r.contract_end).slice(0, 10)}T00:00:00Z`).getTime();
        if (!Number.isNaN(ms)) {
          contractAlerts.push({ ...r, alert_type: 'contract', target_date: r.contract_end, days_remaining: Math.round((ms - baseMs) / 86400000) });
        }
      }
      if (r.probation_end && r.probation_end <= cutoffStr) {
        const ms = new Date(`${String(r.probation_end).slice(0, 10)}T00:00:00Z`).getTime();
        if (!Number.isNaN(ms)) {
          contractAlerts.push({ ...r, alert_type: 'probation', target_date: r.probation_end, days_remaining: Math.round((ms - baseMs) / 86400000) });
        }
      }
    }
    contractAlerts.sort((a, b) => a.days_remaining - b.days_remaining);

    // 5. Pending Approvals Summary
    const pendLeaves = await query.get("SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'Pending'").catch(() => ({ count: 0 }));
    const pendOvertime = await query.get("SELECT COUNT(*) AS count FROM overtime_requests WHERE status = 'Pending'").catch(() => ({ count: 0 }));
    const pendReimb = await query.get("SELECT COUNT(*) AS count FROM reimbursements WHERE status = 'Pending'").catch(() => ({ count: 0 }));
    const pendingApprovals = {
      leaves: pendLeaves ? pendLeaves.count : 0,
      overtime: pendOvertime ? pendOvertime.count : 0,
      reimbursements: pendReimb ? pendReimb.count : 0,
    };
    pendingApprovals.total = pendingApprovals.leaves + pendingApprovals.overtime + pendingApprovals.reimbursements;

    // 6. Turnover Analytics & Rule-Based Early Warning Retensi
    const dt90 = new Date(baseMs);
    dt90.setUTCDate(dt90.getUTCDate() - 90);
    const date90Str = dt90.toISOString().slice(0, 10);
    const dt30 = new Date(baseMs);
    dt30.setUTCDate(dt30.getUTCDate() - 30);
    const date30Str = dt30.toISOString().slice(0, 10);

    const exitedRows = await query.all("SELECT hire_date, resign_date, resign_reason FROM employees WHERE status IN ('Resign', 'Terminated')");
    const exitsLast90d = exitedRows.filter((e) => e.resign_date && e.resign_date >= date90Str).length;
    const totalActiveCount = empTotal ? empTotal.count : 0;
    const turnoverRatePct = Math.round((exitsLast90d / Math.max(1, totalActiveCount + exitsLast90d)) * 1000) / 10;

    let tenureSum = 0;
    let tenureCount = 0;
    for (const ex of exitedRows) {
      if (ex.hire_date && ex.resign_date) {
        const s = new Date(`${String(ex.hire_date).slice(0, 10)}T00:00:00Z`).getTime();
        const e = new Date(`${String(ex.resign_date).slice(0, 10)}T00:00:00Z`).getTime();
        if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
          tenureSum += (e - s) / (86400000 * 30.4375);
          tenureCount++;
        }
      }
    }
    const avgTenureMonths = tenureCount > 0 ? Math.round((tenureSum / tenureCount) * 10) / 10 : 0;

    const reasonCounts = {};
    for (const ex of exitedRows) {
      const r = (ex.resign_reason && String(ex.resign_reason).trim()) || 'Tidak Tercatat';
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    }
    const topResignReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const activeRiskCandidates = await query.all(`
      SELECT e.id, e.name, e.position, e.hire_date, e.contract_end, b.name AS branch_name,
        (SELECT COUNT(*) FROM daily_attendance da WHERE da.employee_id = e.id AND da.date >= ? AND da.is_late = 1) AS late_30d,
        (SELECT COUNT(*) FROM daily_attendance da WHERE da.employee_id = e.id AND da.date >= ? AND da.status = 'Tidak Hadir') AS absent_30d,
        (SELECT COUNT(*) FROM discipline_records dr WHERE dr.employee_id = e.id AND dr.status = 'Aktif') AS active_sp
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.status = 'Active'
    `, [date30Str, date30Str]);

    const dt180 = new Date(baseMs);
    dt180.setUTCDate(dt180.getUTCDate() - 180);
    const date180Str = dt180.toISOString().slice(0, 10);

    const retentionRiskList = [];
    for (const emp of activeRiskCandidates) {
      let score = 0;
      const factors = [];
      if (emp.active_sp > 0) { score += 3; factors.push(`${emp.active_sp} SP Aktif`); }
      if (emp.absent_30d >= 2) { score += 2; factors.push(`${emp.absent_30d}x Alpha (30h)`); }
      if (emp.late_30d >= 4) { score += 2; factors.push(`${emp.late_30d}x Telat (30h)`); }
      if (emp.contract_end) {
        const cMs = new Date(`${String(emp.contract_end).slice(0, 10)}T00:00:00Z`).getTime();
        const rem = Math.round((cMs - baseMs) / 86400000);
        if (!Number.isNaN(rem) && rem <= 14) {
          score += 2;
          factors.push(rem < 0 ? 'Kontrak Lewat' : `Kontrak H-${rem}`);
        }
      }
      if (emp.hire_date && emp.hire_date >= date180Str) {
        score += 1;
        factors.push('Masa Kerja < 6 bln');
      }
      if (score >= 2) {
        retentionRiskList.push({
          id: emp.id,
          name: emp.name,
          position: emp.position,
          branch_name: emp.branch_name,
          risk_score: score,
          risk_level: score >= 4 ? 'Tinggi' : 'Sedang',
          factors,
        });
      }
    }
    retentionRiskList.sort((a, b) => b.risk_score - a.risk_score);

    const userRole = req.user?.role || 'staff';
    const canViewFinancials = ['finance', 'master'].includes(userRole);
    const isMaster = userRole === 'master';

    const safeBranchList = canViewFinancials
      ? branchList
      : branchList.map(({ rent_amount, ...rest }) => rest);

    res.json({
      success: true,
      data: {
        employees: {
          total: empTotal ? empTotal.count : 0,
          frontliner: empFrontliner ? empFrontliner.count : 0,
          staff: empStaff ? empStaff.count : 0,
          resign: empResign ? empResign.count : 0,
          terminated: empTerminated ? empTerminated.count : 0,
          contracts: contractStats,
          pending_promotion: pendingPromotion ? pendingPromotion.count : 0,
          recent: recentEmployees
        },
        branches: {
          total: branchTotal ? branchTotal.count : 0,
          konter: branchKonter ? branchKonter.count : 0,
          gudang: branchGudang ? branchGudang.count : 0,
          kantor: branchKantor ? branchKantor.count : 0,
          petshop: branchPetshop ? branchPetshop.count : 0,
          total_rent: canViewFinancials ? (totalRent ? totalRent.total : 0) : null,
          list: safeBranchList
        },
        settings: isMaster ? settings : {},
        late_rules: lateRules,
        contract_alerts: contractAlerts,
        pending_approvals: pendingApprovals,
        turnover_analytics: {
          total_exits: exitedRows.length,
          exits_last_90d: exitsLast90d,
          turnover_rate_pct: turnoverRatePct,
          avg_tenure_months: avgTenureMonths,
          top_resign_reasons: topResignReasons,
          retention_risk_list: retentionRiskList.slice(0, 8),
        },
      }
    });
  } catch (error) {
    console.error('API Error (master summary):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving master summary' });
  }
};
