const dbModule = require('./db.js');
dbModule.initDb().then(() => {
  console.log('Migrated DB initialized');
  dbModule.query.all(\SELECT c.*, 
             s7.contract_type, s7.salary_offered, s7.allowance, s7.start_date, s7.offering_status,
             ob.day_30_status, ob.day_60_status, ob.day_90_status, ob.kpi_akurasi_transaksi, ob.kpi_kehadiran,
             b.name AS branch_name, b.code AS branch_code, b.city AS branch_city
      FROM candidates c
      LEFT JOIN stage7_offering s7 ON c.id = s7.candidate_id
      LEFT JOIN onboarding ob ON c.id = ob.candidate_id
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.status = 'Hired'\).then(res => console.log('Query success')).catch(err => console.error('Query failed:', err.message));
});
