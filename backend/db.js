const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use DATA_DIR env var for Docker volume, fallback to local directory
const dataDir = process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'recruitment.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper functions for Promises
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Initialize database schema
async function initDb() {
  try {
    // Enable Foreign Keys
    await query.run('PRAGMA foreign_keys = ON');

    // 0. Admins table
    await query.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    // 0a. Audit log (who changed what, via middleware/audit.js)
    await query.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        method TEXT,
        path TEXT,
        status_code INTEGER,
        ip TEXT,
        detail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)').catch(() => {});
    await query.run('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)').catch(() => {});

    // 0b. Recruitment Stages table
    await query.run(`
      CREATE TABLE IF NOT EXISTS recruitment_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        order_num INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1
      )
    `);

    // Seed default stages if empty
    const stageCount = await query.get('SELECT COUNT(*) as count FROM recruitment_stages');
    if (stageCount.count === 0) {
      console.log('Seeding default recruitment stages...');
      const defaultStages = [
        { name: 'Administrasi', code: 'admin' },
        { name: 'Tes Tertulis', code: 'written' },
        { name: 'Role Play', code: 'simulation' },
        { name: 'Wawancara HRD', code: 'interview_hrd' },
        { name: 'Wawancara User', code: 'interview_user' },
        { name: 'Tes Pasca Training', code: 'mcu_ref' },
        { name: 'Offering', code: 'offering' }
      ];
      for (let i = 0; i < defaultStages.length; i++) {
        await query.run(
          'INSERT INTO recruitment_stages (name, code, order_num, is_active) VALUES (?, ?, ?, 1)',
          [defaultStages[i].name, defaultStages[i].code, i + 1]
        );
      }
    }

    // 0c. Stage Generic Evaluations table
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage_generic_evaluations (
        candidate_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        passed INTEGER DEFAULT 0,
        notes TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (candidate_id, stage_id),
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY(stage_id) REFERENCES recruitment_stages(id) ON DELETE CASCADE
      )
    `);

    // Insert default admin if table is empty
    const adminCount = await query.get('SELECT COUNT(*) as count FROM admins');
    const { hashPassword } = require('./utils/crypto');
    if (adminCount.count === 0) {
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
      await query.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashPassword(initialPassword)]);
      if (!process.env.ADMIN_INITIAL_PASSWORD) {
        console.warn('[db] Seeded admin account with the default password "admin123". Log in and change it immediately, or set ADMIN_INITIAL_PASSWORD.');
      }
    } else {
      // Migrate existing plain-text admin password if any
      const existingAdmin = await query.get("SELECT * FROM admins WHERE username = 'admin'");
      if (existingAdmin && !existingAdmin.password.includes(':')) {
        await query.run('UPDATE admins SET password = ? WHERE id = ?', [hashPassword(existingAdmin.password), existingAdmin.id]);
        console.log('Migrated plain text password for admin.');
      }
    }

    // 1. Candidates table
    await query.run(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        nik TEXT UNIQUE,
        email TEXT,
        phone TEXT,
        gender TEXT,
        birth_place TEXT,
        birth_date TEXT,
        religion TEXT,
        marital_status TEXT,
        dependents INTEGER DEFAULT 0,
        blood_type TEXT,
        height INTEGER,
        weight INTEGER,
        physical_condition TEXT,
        address_ktp TEXT,
        address_domicile TEXT,
        emergency_contact_1 TEXT,
        emergency_contact_2 TEXT,
        father_name TEXT,
        mother_name TEXT,
        spouse_name TEXT,
        children_data TEXT, -- JSON string
        education_level TEXT,
        education_institution TEXT,
        education_major TEXT,
        education_years TEXT,
        education_grade TEXT,
        work_experience TEXT, -- JSON string
        npwp TEXT,
        bank_account TEXT,
        bank_name TEXT,
        bpjs_health TEXT,
        bpjs_employment TEXT,
        bpjs_active TEXT,
        uniform_size TEXT,
        health_history TEXT,
        allergies TEXT,
        medications TEXT,
        color_blind_test TEXT,
        status TEXT DEFAULT 'Active', -- 'Active', 'Hired', 'Rejected'
        current_stage INTEGER DEFAULT 1, -- 1-7
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Stage 1 Admin
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage1_admin (
        candidate_id INTEGER PRIMARY KEY,
        berkas_lengkap INTEGER DEFAULT 0,
        usia_sesuai INTEGER DEFAULT 0,
        pendidikan_sesuai INTEGER DEFAULT 0,
        skck_bersih INTEGER DEFAULT 0,
        domisili_sesuai INTEGER DEFAULT 0,
        phone_screen_notes TEXT,
        passed INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 3. Stage 2 Written Test
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage2_written_test (
        candidate_id INTEGER PRIMARY KEY,
        score_numerik REAL DEFAULT 0,
        score_situasional REAL DEFAULT 0,
        score_pengetahuan REAL DEFAULT 0,
        score_nominal REAL DEFAULT 0,
        score_kepribadian TEXT, -- JSON string
        total_score REAL DEFAULT 0,
        passed INTEGER DEFAULT 0,
        test_completed_at DATETIME,
        cognitive_details TEXT, -- JSON string for incorrect answers
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // Migration helper for existing databases (stage2). Newer columns are
    // already part of the CREATE TABLE above for fresh installs.
    await query.run('ALTER TABLE stage2_written_test ADD COLUMN score_nominal REAL DEFAULT 0').catch(() => {});
    await query.run('ALTER TABLE stage2_written_test ADD COLUMN cognitive_details TEXT').catch(() => {});

    // 4. Stage 3 Simulation
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage3_simulation (
        candidate_id INTEGER PRIMARY KEY,
        score_upselling INTEGER DEFAULT 0,
        score_complaint INTEGER DEFAULT 0,
        score_queue INTEGER DEFAULT 0,
        evaluator TEXT,
        notes TEXT,
        passed INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 5. Stage 4 Interview HRD
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage4_interview_hrd (
        candidate_id INTEGER PRIMARY KEY,
        score_integritas INTEGER DEFAULT 0,
        score_pelayanan INTEGER DEFAULT 0,
        score_ketelitian INTEGER DEFAULT 0,
        score_belajar INTEGER DEFAULT 0,
        score_komunikasi INTEGER DEFAULT 0,
        score_budaya INTEGER DEFAULT 0,
        total_weighted_score REAL DEFAULT 0,
        notes TEXT,
        passed INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 6. Stage 5 Interview User
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage5_interview_user (
        candidate_id INTEGER PRIMARY KEY,
        decision TEXT, -- 'Recommended', 'Not Recommended', 'Pending'
        notes TEXT,
        passed INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 7. Stage 6 MCU & Ref Check (Repurposed for Tes Pasca Training)
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage6_mcu_ref (
        candidate_id INTEGER PRIMARY KEY,
        score_training REAL DEFAULT 0,
        test_completed_at DATETIME,
        mcu_buta_warna INTEGER DEFAULT 0,
        mcu_kesehatan_umum INTEGER DEFAULT 0,
        mcu_bebas_narkoba INTEGER DEFAULT 0,
        ref_check_verified INTEGER DEFAULT 0,
        ref_check_notes TEXT,
        passed INTEGER DEFAULT 0,
        training_details TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // Migration helper for existing databases (stage6). No-ops on fresh installs.
    await query.run('ALTER TABLE stage6_mcu_ref ADD COLUMN score_training REAL DEFAULT 0').catch(() => {});
    await query.run('ALTER TABLE stage6_mcu_ref ADD COLUMN test_completed_at DATETIME').catch(() => {});
    await query.run('ALTER TABLE stage6_mcu_ref ADD COLUMN training_details TEXT').catch(() => {});

    // 8. Stage 7 Offering
    await query.run(`
      CREATE TABLE IF NOT EXISTS stage7_offering (
        candidate_id INTEGER PRIMARY KEY,
        contract_type TEXT, -- 'PKWT', 'PKWTT'
        salary_offered REAL DEFAULT 0,
        allowance REAL DEFAULT 0,
        bonus_scheme TEXT,
        start_date TEXT,
        offering_status TEXT DEFAULT 'Pending', -- 'Pending', 'Accepted', 'Declined'
        passed INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 9. Onboarding
    await query.run(`
      CREATE TABLE IF NOT EXISTS onboarding (
        candidate_id INTEGER PRIMARY KEY,
        day_30_status TEXT DEFAULT 'Pending', -- 'Pending', 'Passed', 'Failed'
        day_30_score REAL DEFAULT 0,
        day_30_notes TEXT,
        day_60_status TEXT DEFAULT 'Pending',
        day_60_score REAL DEFAULT 0,
        day_60_notes TEXT,
        day_90_status TEXT DEFAULT 'Pending',
        day_90_score REAL DEFAULT 0,
        day_90_notes TEXT,
        kpi_akurasi_transaksi REAL DEFAULT 0,
        kpi_kehadiran REAL DEFAULT 0,
        kpi_penguasaan_produk REAL DEFAULT 0,
        kpi_kepuasan_pelanggan INTEGER DEFAULT 0,
        kpi_laporan_harian REAL DEFAULT 0,
        kpi_upselling REAL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 9. Candidate Documents Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS candidate_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_id INTEGER NOT NULL,
        doc_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
      )
    `);

    // 10. Branches (Cabang Outlet)
    await query.run(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

      // Migrate: add branch_id and hire_date to candidates if not exists
      await query.run('ALTER TABLE candidates ADD COLUMN branch_id INTEGER REFERENCES branches(id)').catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (branch_id):', e.message);
      });
      await query.run('ALTER TABLE candidates ADD COLUMN hire_date TEXT').catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (hire_date):', e.message);
      });
      await query.run('ALTER TABLE candidates ADD COLUMN is_manual_entry INTEGER DEFAULT 0').catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (is_manual_entry):', e.message);
      });
      // Blind index for the (possibly encrypted) NIK: keeps uniqueness + exact lookup.
      await query.run('ALTER TABLE candidates ADD COLUMN nik_bidx TEXT').catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (nik_bidx):', e.message);
      });
      await query.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_nik_bidx ON candidates(nik_bidx)').catch(() => {});

      await migrateFieldEncryption();

      // Branch attribute migrations
      await query.run("ALTER TABLE branches ADD COLUMN location_type TEXT DEFAULT 'Konter'").catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (location_type):', e.message);
      });
      await query.run('ALTER TABLE branches ADD COLUMN has_petshop INTEGER DEFAULT 0').catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (has_petshop):', e.message);
      });
      await query.run('ALTER TABLE branches ADD COLUMN rent_amount REAL DEFAULT 0').catch(e => {
        if (!e.message.includes('duplicate column')) console.error('Migration error (rent_amount):', e.message);
      });

      // System Settings (key-value store for configurable parameters)
      await query.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const settingsCount = await query.get('SELECT COUNT(*) as count FROM system_settings');
      if (settingsCount.count === 0) {
        for (const [key, value] of [
          ['payroll_period_start_day', '29'],
          ['payroll_period_end_day', '28'],
          ['working_days_per_month', '25'],
        ]) {
          await query.run('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, value]);
        }
      }

      // Late Penalty Rules (ASBEN — configurable denda keterlambatan)
      await query.run(`
        CREATE TABLE IF NOT EXISTS late_penalty_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          min_count INTEGER NOT NULL,
          max_count INTEGER,
          penalty_per_occurrence INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const penaltyCount = await query.get('SELECT COUNT(*) as count FROM late_penalty_rules');
      if (penaltyCount.count === 0) {
        await query.run('INSERT INTO late_penalty_rules (min_count, max_count, penalty_per_occurrence) VALUES (?, ?, ?)', [1, 3, 0]);
        await query.run('INSERT INTO late_penalty_rules (min_count, max_count, penalty_per_occurrence) VALUES (?, ?, ?)', [4, 5, 25000]);
        await query.run('INSERT INTO late_penalty_rules (min_count, max_count, penalty_per_occurrence) VALUES (?, ?, ?)', [6, null, 50000]);
      }

      // Employees table (separate from candidates — full HR employee records)
      await query.run(`
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER REFERENCES candidates(id),
          name TEXT NOT NULL,
          nik TEXT,
          nik_bidx TEXT,
          gender TEXT,
          birth_place TEXT,
          birth_date TEXT,
          religion TEXT,
          marital_status TEXT,
          dependents INTEGER DEFAULT 0,
          blood_type TEXT,
          phone TEXT,
          email TEXT,
          address_ktp TEXT,
          address_domicile TEXT,
          emergency_contact_1 TEXT,
          emergency_contact_2 TEXT,
          father_name TEXT,
          mother_name TEXT,
          spouse_name TEXT,
          children_data TEXT,
          education_level TEXT,
          education_institution TEXT,
          education_major TEXT,
          education_years TEXT,
          education_grade TEXT,
          work_experience TEXT,
          npwp TEXT,
          bank_name TEXT,
          bank_account TEXT,
          bpjs_health TEXT,
          bpjs_employment TEXT,
          bpjs_active TEXT DEFAULT 'Tidak Aktif',
          uniform_size TEXT,
          health_history TEXT,
          allergies TEXT,
          medications TEXT,
          color_blind_test TEXT,
          position TEXT,
          employee_type TEXT DEFAULT 'Frontliner',
          contract_type TEXT DEFAULT 'PKWT',
          branch_id INTEGER REFERENCES branches(id),
          hire_date TEXT,
          salary REAL DEFAULT 0,
          allowance REAL DEFAULT 0,
          status TEXT DEFAULT 'Active',
          resign_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await query.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_nik_bidx ON employees(nik_bidx)').catch(() => {});
      // height/weight/physical_condition for employees table
      await query.run('ALTER TABLE employees ADD COLUMN height REAL').catch(() => {});
      await query.run('ALTER TABLE employees ADD COLUMN weight REAL').catch(() => {});
      await query.run('ALTER TABLE employees ADD COLUMN physical_condition TEXT').catch(() => {});
      await migrateEmployeeEncryption();

      // Daily Attendance (per karyawan per tanggal — sumber data utama)
      await query.run(`
        CREATE TABLE IF NOT EXISTS daily_attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          date TEXT NOT NULL,
          shift TEXT,
          check_in_time TEXT,
          status TEXT NOT NULL DEFAULT 'Belum Absen',
          is_late INTEGER DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(employee_id, date)
        )
      `);
      await query.run('CREATE INDEX IF NOT EXISTS idx_daily_att_date ON daily_attendance(date)').catch(() => {});
      await query.run('CREATE INDEX IF NOT EXISTS idx_daily_att_emp ON daily_attendance(employee_id)').catch(() => {});

      // Attendance Records (agregat bulanan — otomatis di-sync dari daily_attendance, digunakan payroll)
      await query.run(`
        CREATE TABLE IF NOT EXISTS attendance_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          period TEXT NOT NULL,
          days_absent INTEGER DEFAULT 0,
          late_count INTEGER DEFAULT 0,
          cash_advance REAL DEFAULT 0,
          fake_money REAL DEFAULT 0,
          deduction_absent REAL DEFAULT 0,
          deduction_late REAL DEFAULT 0,
          asben_contribution REAL DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(employee_id, period)
        )
      `);
      await query.run('CREATE INDEX IF NOT EXISTS idx_attendance_period ON attendance_records(period)').catch(() => {});
      await query.run('CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id)').catch(() => {});

      // Seed shift cutoff times if not exists
      const shiftSettings = [
        ['shift_pagi_cutoff', '06:30'],
        ['shift_siang_cutoff', '14:30'],
      ];
      for (const [key, value] of shiftSettings) {
        const exists = await query.get('SELECT 1 FROM system_settings WHERE key = ?', [key]);
        if (!exists) await query.run('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, value]);
      }

      // Payroll Periods (satu period per YYYY-MM, mencakup semua tipe karyawan)
      await query.run(`
        CREATE TABLE IF NOT EXISTS payroll_periods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'Draft',
          submitted_at DATETIME,
          submitted_by TEXT,
          approved_at DATETIME,
          owner_notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Payroll Entries (satu baris per karyawan per period)
      await query.run(`
        CREATE TABLE IF NOT EXISTS payroll_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payroll_period_id INTEGER NOT NULL REFERENCES payroll_periods(id),
          period TEXT NOT NULL,
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          branch_id INTEGER REFERENCES branches(id),
          employee_type TEXT,
          salary REAL DEFAULT 0,
          allowance REAL DEFAULT 0,
          bonus_penjualan REAL DEFAULT 0,
          bonus_tartun REAL DEFAULT 0,
          bonus_lain REAL DEFAULT 0,
          bonus_lain_label TEXT,
          bonus_ditahan REAL DEFAULT 0,
          deduction_kasbon REAL DEFAULT 0,
          deduction_absent REAL DEFAULT 0,
          deduction_late REAL DEFAULT 0,
          deduction_fake_money REAL DEFAULT 0,
          take_home_pay REAL DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(payroll_period_id, employee_id)
        )
      `);
      await query.run('CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON payroll_entries(period)').catch(() => {});

      // Migrate: add missing columns for onboarding and stage7_offering (robustness for older DBs)
      const onboardingCols = [
        "day_30_status TEXT DEFAULT 'Pending'", "day_30_score REAL DEFAULT 0", "day_30_notes TEXT",
        "day_60_status TEXT DEFAULT 'Pending'", "day_60_score REAL DEFAULT 0", "day_60_notes TEXT",
        "day_90_status TEXT DEFAULT 'Pending'", "day_90_score REAL DEFAULT 0", "day_90_notes TEXT",
        "kpi_akurasi_transaksi REAL DEFAULT 0", "kpi_kehadiran REAL DEFAULT 0", "kpi_penguasaan_produk REAL DEFAULT 0",
        "kpi_kepuasan_pelanggan INTEGER DEFAULT 0", "kpi_laporan_harian REAL DEFAULT 0", "kpi_upselling REAL DEFAULT 0"
      ];
      for (const col of onboardingCols) {
        await query.run(`ALTER TABLE onboarding ADD COLUMN ${col}`).catch(() => {});
      }

      const stage7Cols = [
        "contract_type TEXT", "salary_offered REAL DEFAULT 0", "allowance REAL DEFAULT 0",
        "bonus_scheme TEXT", "start_date TEXT", "offering_status TEXT DEFAULT 'Pending'", "passed INTEGER DEFAULT 0"
      ];
      for (const col of stage7Cols) {
        await query.run(`ALTER TABLE stage7_offering ADD COLUMN ${col}`).catch(() => {});
      }

    // 11. Test Questions
    await query.run(`
      CREATE TABLE IF NOT EXISTS test_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtest TEXT NOT NULL, -- 'numerik', 'situasional', 'produk', 'kepribadian'
        question_text TEXT NOT NULL,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        correct_option TEXT, -- 'A', 'B', 'C', 'D' (NULL for kepribadian)
        question_type TEXT DEFAULT 'multiple-choice', -- 'multiple-choice', 'likert', 'forced-choice'
        dimension TEXT, -- For personality (Kejujuran, etc)
        option_p TEXT, -- For forced-choice option P
        option_q TEXT  -- For forced-choice option Q
      )
    `);

    // 9b. Training Questions Table
    await query.run(`
      CREATE TABLE IF NOT EXISTS training_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        statement_text TEXT NOT NULL,
        order_num INTEGER DEFAULT 0
      )
    `);

    // Check if training questions are already seeded
    const tCount = await query.get('SELECT COUNT(*) as count FROM training_questions');
    if (tCount.count === 0) {
      console.log('Seeding training questions...');
      const defaultStatements = [
        "Karyawan mampu melakukan transaksi Bee",
        "Karyawan memahami SOP pelayanan ramah 3S (Senyum, Sapa, Salam)",
        "Karyawan mampu melakukan pengisian pulsa dan penanganan keluhan pelanggan",
        "Karyawan disiplin dalam administrasi laporan laci kasir harian"
      ];
      for (let i = 0; i < defaultStatements.length; i++) {
        await query.run('INSERT INTO training_questions (statement_text, order_num) VALUES (?, ?)', [defaultStatements[i], i + 1]);
      }
    }

    // Clean up cognitive test table from training questions if any exist
    await query.run("DELETE FROM test_questions WHERE subtest = 'training'").catch(() => {});

    // Check if questions are already seeded
    const qCount = await query.get('SELECT COUNT(*) as count FROM test_questions');
    if (qCount.count === 0) {
      console.log('Seeding test questions...');
      await seedQuestions();
    }

  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

/**
 * When DATA_ENCRYPTION_KEY is configured, encrypt any still-plaintext values in
 * the sensitive candidate columns and backfill the NIK blind index. Idempotent:
 * after the first run every value is already encrypted, so no rows are written.
 */
async function migrateFieldEncryption() {
  const fieldCrypto = require('./utils/fieldCrypto');
  if (!fieldCrypto.isEnabled()) return;

  const cols = fieldCrypto.ENCRYPTED_COLUMNS;
  const rows = await query.all(`SELECT id, nik_bidx, ${cols.join(', ')} FROM candidates`);
  let migrated = 0;

  for (const row of rows) {
    const sets = [];
    const params = [];
    for (const col of cols) {
      const current = row[col];
      if (current == null || current === '') continue;
      const desired = fieldCrypto.encrypt(fieldCrypto.decrypt(current));
      if (desired !== current) { sets.push(`${col} = ?`); params.push(desired); }
    }
    if (row.nik && !row.nik_bidx) {
      const bidx = fieldCrypto.blindIndex(fieldCrypto.decrypt(row.nik));
      if (bidx) { sets.push('nik_bidx = ?'); params.push(bidx); }
    }
    if (!sets.length) continue;
    params.push(row.id);
    try {
      await query.run(`UPDATE candidates SET ${sets.join(', ')} WHERE id = ?`, params);
      migrated++;
    } catch (e) {
      console.error(`[db] Encryption migration failed for candidate ${row.id}:`, e.message);
    }
  }
  if (migrated) console.log(`[db] Encrypted sensitive fields for ${migrated} existing candidate row(s).`);
}

async function migrateEmployeeEncryption() {
  const fieldCrypto = require('./utils/fieldCrypto');
  if (!fieldCrypto.isEnabled()) return;

  const cols = fieldCrypto.ENCRYPTED_COLUMNS;
  const rows = await query.all(`SELECT id, nik_bidx, ${cols.join(', ')} FROM employees`);
  let migrated = 0;

  for (const row of rows) {
    const sets = [];
    const params = [];
    for (const col of cols) {
      const current = row[col];
      if (current == null || current === '') continue;
      const desired = fieldCrypto.encrypt(fieldCrypto.decrypt(current));
      if (desired !== current) { sets.push(`${col} = ?`); params.push(desired); }
    }
    if (row.nik && !row.nik_bidx) {
      const bidx = fieldCrypto.blindIndex(fieldCrypto.decrypt(row.nik));
      if (bidx) { sets.push('nik_bidx = ?'); params.push(bidx); }
    }
    if (!sets.length) continue;
    params.push(row.id);
    try {
      await query.run(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, params);
      migrated++;
    } catch (e) {
      console.error(`[db] Encryption migration failed for employee ${row.id}:`, e.message);
    }
  }
  if (migrated) console.log(`[db] Encrypted sensitive fields for ${migrated} existing employee row(s).`);
}

async function seedQuestions() {
  const questions = [
    // Subtest: Numerik & Kasir (5 questions)
    {
      subtest: 'numerik',
      question_text: 'Pelanggan membeli: pulsa Rp 50.000 + paket data Rp 35.000 + aksesoris Rp 27.500. Pelanggan membayar dengan uang Rp 150.000. Berapa kembalian yang harus diberikan?',
      option_a: 'Rp 27.500',
      option_b: 'Rp 37.500',
      option_c: 'Rp 47.500',
      option_d: 'Rp 32.500',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'numerik',
      question_text: 'Toko mendapat target penjualan Rp 12.000.000/bulan. Hari ini sudah terjual Rp 8.750.000. Berapa persen target yang sudah tercapai? (Bulatkan ke desimal terdekat)',
      option_a: '68,5%',
      option_b: '72,9%',
      option_c: '75,0%',
      option_d: '70,3%',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'numerik',
      question_text: 'Seorang pelanggan membayar tagihan listrik Rp 237.500, tagihan BPJS Rp 168.000, dan beli pulsa Rp 100.000. Admin fee masing-masing Rp 2.500. Total yang harus dibayar pelanggan adalah:',
      option_a: 'Rp 505.500',
      option_b: 'Rp 513.000',
      option_c: 'Rp 508.000',
      option_d: 'Rp 515.500',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'numerik',
      question_text: 'Stok awal pulsa elektronik Rp 500.000 adalah 30 voucher. Terjual 18 voucher, masuk kiriman 12 voucher, terjual lagi 7 voucher. Berapa stok akhir?',
      option_a: '15',
      option_b: '17',
      option_c: '19',
      option_d: '13',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'numerik',
      question_text: 'Rekonsiliasi Kas: Saldo awal kas: Rp 500.000. Total penjualan tunai hari ini: Rp 3.275.000. Total setoran ke rekening: Rp 2.000.000. Retur/refund: Rp 50.000. Pengeluaran operasional: Rp 75.000. Berapa saldo kas akhir yang seharusnya ada di laci?',
      option_a: 'Rp 1.550.000',
      option_b: 'Rp 1.650.000',
      option_c: 'Rp 1.700.000',
      option_d: 'Rp 1.600.000',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },

    // Subtest: Situasional Pelayanan (5 questions)
    {
      subtest: 'situasional',
      question_text: 'Seorang pelanggan marah-marah karena transaksi pulsa gagal, padahal uangnya sudah terpotong. Antrean di belakang sudah ada 5 orang. Apa yang Anda lakukan?',
      option_a: 'Meminta pelanggan kembali besok karena Anda sedang sibuk',
      option_b: 'Meminta maaf, mencatat nomor HP dan nominal, meminta pelanggan menunggu sebentar, lalu cek sistem sambil tetap melayani antrian',
      option_c: 'Langsung mengembalikan uang agar pelanggan cepat pergi',
      option_d: 'Menjelaskan bahwa itu bukan kesalahan toko dan minta pelanggan hubungi operator',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'situasional',
      question_text: 'Pelanggan meminta Anda mendaftarkan kartu SIM baru, tetapi KTP yang dibawa adalah milik orang lain (saudara kandungnya). Apa yang Anda lakukan?',
      option_a: 'Tetap mendaftarkan karena pelanggan meyakinkan itu saudaranya',
      option_b: 'Menolak dan menjelaskan bahwa regulasi Kominfo mengharuskan KTP asli pemilik kartu',
      option_c: 'Minta foto KTP saja dan lanjutkan proses',
      option_d: 'Abaikan peraturan jika pelanggan tampak jujur',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'situasional',
      question_text: 'Anda menemukan selisih kas sebesar Rp 50.000 (lebih) di akhir shift. Apa yang Anda lakukan?',
      option_a: 'Simpan sendiri karena tidak tahu milik siapa',
      option_b: 'Lapor kepada atasan dan catat dalam laporan kas harian sebagai "selisih lebih"',
      option_c: 'Masukkan ke kas toko tanpa melaporkan ke atasan',
      option_d: 'Berikan kepada rekan kerja yang membutuhkan',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'situasional',
      question_text: 'Pelanggan membeli HP seharga Rp 1.500.000 dan meminta diskon 20% yang tidak ada dalam promosi aktif. Dia mengancam akan beli di tempat lain. Apa yang Anda lakukan?',
      option_a: 'Langsung berikan diskon 20% agar pelanggan tidak pergi',
      option_b: 'Jelaskan bahwa harga sudah final, tawarkan bonus aksesoris atau cicilan 0% jika tersedia, lalu hubungi supervisor jika perlu',
      option_c: 'Tolak pelanggan dengan tegas tanpa menawarkan solusi lain',
      option_d: 'Berjanji diskon bisa diberikan besok',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'situasional',
      question_text: 'Anda mendapati rekan kerja Anda memindahkan Rp 20.000 dari laci kas ke sakunya saat kondisi toko sedang sepi. Apa yang Anda lakukan?',
      option_a: 'Diam saja karena tidak mau konflik',
      option_b: 'Tegur rekan secara langsung dan minta dikembalikan; jika menolak, laporkan ke atasan',
      option_c: 'Langsung lapor ke atasan tanpa bicara dengan rekan kerja dulu',
      option_d: 'Ikut mengambil juga agar adil',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },

    // Subtest: Pengetahuan Produk & Teknologi (5 questions)
    {
      subtest: 'produk',
      question_text: 'Singkatan PPOB dalam konteks bisnis konter pulsa adalah:',
      option_a: 'Pulsa dan Paket Online Bank',
      option_b: 'Payment Point Online Bank',
      option_c: 'Produk dan Paket Online Berbayar',
      option_d: 'Platform Pembayaran Online Bank',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'produk',
      question_text: 'Pelanggan ingin membeli paket internet "unlimited" dari operator X. Apa yang sebaiknya Anda tanyakan lebih dulu?',
      option_a: 'Berapa anggaran yang dimiliki pelanggan (plus nomor HP, provider, dan kebutuhan utama)',
      option_b: 'Apakah HP pelanggan masih baru',
      option_c: 'Kapan terakhir mengisi pulsa',
      option_d: 'Di mana pelanggan tinggal',
      correct_option: 'A',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'produk',
      question_text: 'Regulasi pemerintah mengharuskan pendaftaran kartu SIM menggunakan data kependudukan. Dokumen yang wajib digunakan adalah:',
      option_a: 'SIM dan Kartu Keluarga',
      option_b: 'KTP elektronik (e-KTP) dan Nomor Induk Kependudukan (NIK)',
      option_c: 'Paspor dan NPWP',
      option_d: 'Kartu pelajar dan akta lahir',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'produk',
      question_text: 'Apa fungsi utama aplikasi cek sinyal / field force yang biasanya digunakan di konter pulsa?',
      option_a: 'Mengirim pesan promosi ke pelanggan',
      option_b: 'Mengecek kualitas jaringan, stok, dan melakukan transaksi digital',
      option_c: 'Mengelola absensi karyawan',
      option_d: 'Memfoto produk untuk katalog',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },
    {
      subtest: 'produk',
      question_text: 'Token listrik prabayar diterbitkan oleh:',
      option_a: 'Kementerian ESDM',
      option_b: 'PLN (Perusahaan Listrik Negara)',
      option_c: 'Badan Regulasi Telekomunikasi Indonesia',
      option_d: 'Operator seluler',
      correct_option: 'B',
      question_type: 'multiple-choice'
    },

    // Subtest: Kepribadian & Integritas (7 Likert-scale statements)
    {
      subtest: 'kepribadian',
      question_text: 'Saya akan melaporkan kelebihan uang kembalian meskipun tidak ada yang tahu.',
      question_type: 'likert',
      dimension: 'Kejujuran'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Saya tetap bisa bekerja dengan baik meski antrian panjang dan pelanggan tidak sabar.',
      question_type: 'likert',
      dimension: 'Ketahanan Tekanan'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Saya merasa puas ketika berhasil menyelesaikan masalah pelanggan.',
      question_type: 'likert',
      dimension: 'Orientasi Layanan'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Saya selalu datang tepat waktu meskipun tidak ada yang mengawasi.',
      question_type: 'likert',
      dimension: 'Disiplin'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Saya mudah mempelajari aplikasi atau prosedur baru.',
      question_type: 'likert',
      dimension: 'Adaptabilitas'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Saya bersedia membantu rekan kerja meski itu bukan tanggung jawab saya.',
      question_type: 'likert',
      dimension: 'Kerja Tim'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Saya tidak membalas kekasaran pelanggan dengan sikap kasar.',
      question_type: 'likert',
      dimension: 'Kontrol Diri'
    },

    // Forced Choice Questions (3 questions)
    {
      subtest: 'kepribadian',
      question_text: 'Dari pasangan pernyataan berikut, pilih yang paling menggambarkan diri Anda:',
      question_type: 'forced-choice',
      dimension: 'Target vs Fleksibilitas',
      option_p: 'Saya lebih suka bekerja dengan target yang jelas dan terukur',
      option_q: 'Saya lebih suka bekerja dalam lingkungan yang fleksibel dan berubah-ubah'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Dari pasangan pernyataan berikut, pilih yang paling menggambarkan diri Anda:',
      question_type: 'forced-choice',
      dimension: 'Mandiri vs Tim',
      option_p: 'Ketika ada masalah, saya segera mencari solusinya sendiri',
      option_q: 'Ketika ada masalah, saya memilih mendiskusikannya dulu dengan tim'
    },
    {
      subtest: 'kepribadian',
      question_text: 'Dari pasangan pernyataan berikut, pilih yang paling menggambarkan diri Anda:',
      question_type: 'forced-choice',
      dimension: 'Multitasking vs Fokus',
      option_p: 'Melayani banyak pelanggan dalam satu waktu membuat saya bersemangat',
      option_q: 'Saya bekerja lebih baik saat fokus pada satu hal dalam satu waktu'
    },
    // Subtest: Penulisan Nominal (3 questions as essay)
    {
      subtest: 'nominal',
      question_text: 'Satu juta lima ratus lima puluh ribu rupiah ditulis:',
      correct_option: 'Rp. 1.550.000',
      question_type: 'essay'
    },
    {
      subtest: 'nominal',
      question_text: 'Dua ratus tujuh puluh lima ribu lima ratus rupiah ditulis:',
      correct_option: 'Rp. 275.500',
      question_type: 'essay'
    },
    {
      subtest: 'nominal',
      question_text: 'Satu juta lima puluh ribu rupiah ditulis:',
      correct_option: 'Rp. 1.050.000',
      question_type: 'essay'
    }
  ];

  for (const q of questions) {
    await query.run(
      `INSERT INTO test_questions 
       (subtest, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, dimension, option_p, option_q) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        q.subtest,
        q.question_text,
        q.option_a || null,
        q.option_b || null,
        q.option_c || null,
        q.option_d || null,
        q.correct_option || null,
        q.question_type,
        q.dimension || null,
        q.option_p || null,
        q.option_q || null
      ]
    );
  }
  console.log('Seeded', questions.length, 'questions successfully.');
}

// Export database interface
module.exports = {
  query,
  initDb,
  db,
  dataDir,
  uploadsDir,
  migrateEmployeeEncryption,
};
