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
          petshop: branchPetshop ? branchPetshop.count : 0,
          total_rent: totalRent ? totalRent.total : 0,
          list: branchList
        },
        settings,
        late_rules: lateRules
      }
    });
  } catch (error) {
    console.error('API Error (master summary):', error);
    res.status(500).json({ success: false, message: 'Server error retrieving master summary' });
  }
};
