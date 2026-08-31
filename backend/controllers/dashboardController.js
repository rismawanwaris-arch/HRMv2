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
