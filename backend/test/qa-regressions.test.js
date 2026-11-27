const { app, request, dbReady, login, authed } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sqlite3 = require('sqlite3');
const xlsx = require('xlsx');

let masterToken;
let masterApi;
let financeToken;
let financeApi;
let staffToken;
let staffApi;

test.before(async () => {
  await dbReady();
  masterToken = await login();
  masterApi = authed(masterToken);

  const suffix = Date.now();
  const finUser = `qa_fin_${suffix}`;
  const stfUser = `qa_stf_${suffix}`;

  const finCreate = await masterApi.post('/api/admins').send({
    username: finUser,
    password: 'QaPassword123!',
    role: 'finance',
  });
  assert.equal(finCreate.status, 200);

  const stfCreate = await masterApi.post('/api/admins').send({
    username: stfUser,
    password: 'QaPassword123!',
    role: 'staff',
  });
  assert.equal(stfCreate.status, 200);

  financeToken = await login(finUser, 'QaPassword123!');
  financeApi = authed(financeToken);
  staffToken = await login(stfUser, 'QaPassword123!');
  staffApi = authed(staffToken);
});

test('RBAC: auth tokens and role matrix enforcement', async () => {
  const noTok = await request(app).get('/api/staff');
  assert.equal(noTok.status, 401);
  assert.equal(noTok.body.code, 'TOKEN_MISSING');

  const badTok = await request(app)
    .get('/api/staff')
    .set('Authorization', 'Bearer invalid.jwt.token');
  assert.equal(badTok.status, 401);
  assert.equal(badTok.body.code, 'TOKEN_INVALID');

  // staff allowed vs forbidden
  assert.equal((await staffApi.get('/api/branches')).status, 200);
  assert.equal((await staffApi.get('/api/attendance/daily?date=2026-11-19')).status, 200);
  assert.equal((await staffApi.get('/api/candidates')).status, 200);

  for (const pathBlocked of ['/api/staff', '/api/payroll/periods', '/api/financial/outlet?period=2026-11', '/api/settings']) {
    const r = await staffApi.get(pathBlocked);
    assert.equal(r.status, 403, `Expected 403 for staff on ${pathBlocked}, got ${r.status}`);
    assert.equal(r.body.code, 'FORBIDDEN_ROLE');
  }

  // finance allowed vs forbidden
  assert.equal((await financeApi.get('/api/staff')).status, 200);
  assert.equal((await financeApi.get('/api/payroll/periods')).status, 200);
  assert.equal((await financeApi.get('/api/financial/outlet?period=2026-11')).status, 200);
  assert.equal((await financeApi.get('/api/discipline')).status, 200);

  for (const pathBlocked of ['/api/candidates', '/api/settings']) {
    const r = await financeApi.get(pathBlocked);
    assert.equal(r.status, 403, `Expected 403 for finance on ${pathBlocked}, got ${r.status}`);
    assert.equal(r.body.code, 'FORBIDDEN_ROLE');
  }
});

function countTables(dbFile) {
  return new Promise((resolve, reject) => {
    const conn = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      const tables = ['employees', 'branches', 'candidates', 'admins'];
      const out = {};
      let i = 0;
      const next = () => {
        if (i >= tables.length) {
          conn.close(() => resolve(out));
          return;
        }
        const tbl = tables[i++];
        conn.get(`SELECT COUNT(*) AS cnt FROM ${tbl}`, (qErr, row) => {
          if (qErr) {
            out[tbl] = null;
          } else {
            out[tbl] = row.cnt;
          }
          next();
        });
      };
      next();
    });
  });
}

test('startup initDb migration on isolated clone of live recruitment.db is non-destructive', async () => {
  const liveDb = path.join(__dirname, '..', 'recruitment.db');
  if (!fs.existsSync(liveDb)) return; // Skip cleanly if no live snapshot exists in CI

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrm-mig-'));
  try {
    const clonedDb = path.join(tmpDir, 'recruitment.db');
    fs.copyFileSync(liveDb, clonedDb);

    const beforeCounts = await countTables(clonedDb);

    execFileSync(
      process.execPath,
      ['-e', "const { initDb, db } = require('./db'); initDb().then(() => { db.close(() => process.exit(0)); }).catch((e) => { console.error(e); process.exit(1); });"],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          DATA_DIR: tmpDir,
          NODE_ENV: 'test',
          JWT_SECRET: 'test-migration-secret-0123456789abcdef',
        },
        stdio: 'pipe',
      }
    );

    const afterCounts = await countTables(clonedDb);
    assert.deepEqual(afterCounts, beforeCounts, 'Row counts must stay intact after startup migration');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('staff CRUD, physical fields, partial Excel import preservation & promoteFromCandidate', async () => {
  const branchRes = await masterApi.post('/api/branches').send({
    code: 'QA-S1',
    name: 'Konter QA Staff',
    location_type: 'Konter',
    rent_amount: 1000000,
  });
  assert.equal(branchRes.status, 200);
  const branchId = branchRes.body.data.id;

  // Create staff with NIK and physical fields
  const nikVal = '3201010101910001';
  const createRes = await financeApi.post('/api/staff').send({
    name: 'Staff Regresi',
    nik: nikVal,
    phone: '08123450001',
    height: '172',
    weight: '66',
    physical_condition: 'Sehat Jasmani',
    color_blind_test: 'Normal',
    branch_id: branchId,
    employee_type: 'Staff',
    position: 'Supervisor',
    salary: 4500000,
    allowance: 500000,
  });
  assert.equal(createRes.status, 200);
  const staffId = createRes.body.employeeId;

  const detail = await financeApi.get(`/api/staff/${staffId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.nik, nikVal);
  assert.equal('nik_bidx' in detail.body.data, false);
  assert.equal(String(detail.body.data.height), '172');
  assert.equal(String(detail.body.data.weight), '66');
  assert.equal(detail.body.data.physical_condition, 'Sehat Jasmani');
  assert.equal(detail.body.data.color_blind_test, 'Normal');

  // Update position keeping NIK and physical fields intact
  const updRes = await financeApi.put(`/api/staff/${staffId}`).send({
    ...detail.body.data,
    position: 'Area Supervisor',
  });
  assert.equal(updRes.status, 200);
  const afterUpd = await financeApi.get(`/api/staff/${staffId}`);
  assert.equal(afterUpd.body.data.position, 'Area Supervisor');
  assert.equal(afterUpd.body.data.nik, nikVal);
  assert.equal(String(afterUpd.body.data.height), '172');

  // Manual employee + partial Excel import preservation
  const manNik = '3201010101920002';
  const manRes = await financeApi.post('/api/employees/manual').send({
    name: 'Partial Import Emp',
    nik: manNik,
    phone: '081999888777',
    branch_id: branchId,
    employee_type: 'Frontliner',
    position: 'Kasir Senior',
    salary_offered: 3200000,
    allowance: 300000,
  });
  assert.equal(manRes.status, 200);

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ['Nama Lengkap', 'NIK', 'Ukuran Seragam'],
    ['Partial Import Emp', manNik, 'XL'],
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'Data');
  const xlsxBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const impRes = await financeApi
    .post('/api/employees/import')
    .attach('file', xlsxBuf, 'partial.xlsx');
  assert.equal(impRes.status, 200);
  assert.equal(impRes.body.success, true);

  const listStaff = await financeApi.get('/api/staff?search=Partial');
  const foundStaff = listStaff.body.data.find((e) => e.name === 'Partial Import Emp');
  assert.ok(foundStaff, 'Imported employee must exist in staff list');
  assert.equal(foundStaff.uniform_size, 'XL');
  assert.equal(foundStaff.phone, '081999888777');
  assert.equal(foundStaff.position, 'Kasir Senior');
  assert.equal(foundStaff.salary, 3200000);
  assert.equal(foundStaff.allowance, 300000);
});

test('attendance double save, 6:00 normalization, notes & cutoffs + payroll reset-to-zero, branch filter, summary & slip', async () => {
  const branchRes = await masterApi.post('/api/branches').send({
    code: 'QA-AP1',
    name: 'Konter Absen Payroll',
    location_type: 'Konter',
    rent_amount: 500000,
  });
  assert.equal(branchRes.status, 200);
  const branchId = branchRes.body.data.id;

  const empRes = await financeApi.post('/api/staff').send({
    name: 'Karyawan Absen',
    branch_id: branchId,
    employee_type: 'Frontliner',
    position: 'Frontliner',
    salary: 3000000,
    allowance: 250000,
    bank_name: 'BCA',
    bank_account: '8877665544',
  });
  assert.equal(empRes.status, 200);
  const empId = empRes.body.employeeId;

  // Save daily attendance with single-digit hour "6:00"
  const save1 = await staffApi
    .put(`/api/attendance/daily/${empId}/2026-11-05`)
    .send({ shift: 'Pagi', check_in_time: '6:00', notes: 'Datang awal' });
  assert.equal(save1.status, 200);
  assert.equal(save1.body.data.id, empId);
  assert.ok(save1.body.data.record_id > 0);
  assert.equal(save1.body.data.check_in_time, '06:00');
  assert.equal(save1.body.data.status, 'Hadir');
  assert.equal(save1.body.data.notes, 'Datang awal');

  // Repeat save (same employee/date) updating time to Telat
  const save2 = await staffApi
    .put(`/api/attendance/daily/${empId}/2026-11-05`)
    .send({ shift: 'Pagi', check_in_time: '07:15', notes: 'Terlambat macet' });
  assert.equal(save2.status, 200);
  assert.equal(save2.body.data.id, empId);
  assert.equal(save2.body.data.record_id, save1.body.data.record_id);
  assert.equal(save2.body.data.status, 'Telat');
  assert.equal(save2.body.data.notes, 'Terlambat macet');

  // Verify getByDate returns cutoffs and updated row
  const dayRes = await staffApi.get('/api/attendance/daily?date=2026-11-05');
  assert.equal(dayRes.status, 200);
  assert.ok(dayRes.body.cutoffs && dayRes.body.cutoffs.pagi && dayRes.body.cutoffs.siang);
  const empRow = dayRes.body.data.find((r) => r.id === empId);
  assert.equal(empRow.status, 'Telat');
  assert.equal(empRow.notes, 'Terlambat macet');

  // Add 3 more late days in period 2026-11 (29 Oct - 28 Nov) => total 4 late occurrences => ASBEN = 25000 on the 4th
  for (const d of ['2026-11-06', '2026-11-07', '2026-11-08']) {
    const r = await staffApi
      .put(`/api/attendance/daily/${empId}/${d}`)
      .send({ shift: 'Pagi', check_in_time: '07:30' });
    assert.equal(r.status, 200);
  }

  // Payroll generate, update bonus, reset bonus to 0, branch filter, summary, decrypted slip
  const genRes = await financeApi.post('/api/payroll/periods/2026-11/generate');
  assert.equal(genRes.status, 200);

  const entriesRes = await financeApi.get(`/api/payroll/periods/2026-11/entries?branch_id=${branchId}`);
  assert.equal(entriesRes.status, 200);
  assert.ok(entriesRes.body.data.length >= 1);
  const myEntry = entriesRes.body.data.find((e) => e.employee_id === empId);
  assert.ok(myEntry);

  const addBonus = await financeApi.put(`/api/payroll/entries/${myEntry.id}`).send({ bonus_penjualan: 300000 });
  assert.equal(addBonus.status, 200);
  assert.equal(addBonus.body.data.bonus_penjualan, 300000);

  const resetBonus = await financeApi.put(`/api/payroll/entries/${myEntry.id}`).send({ bonus_penjualan: 0 });
  assert.equal(resetBonus.status, 200);
  assert.equal(resetBonus.body.data.bonus_penjualan, 0, 'Resetting bonus to 0 must persist as 0');

  const sumRes = await financeApi.get('/api/payroll/periods/2026-11/summary');
  assert.equal(sumRes.status, 200);
  assert.ok(sumRes.body.data.some((r) => r.branch_id === branchId));

  const slipRes = await financeApi.get(`/api/payroll/entries/${myEntry.id}/slip`);
  assert.equal(slipRes.status, 200);
  assert.equal(slipRes.body.data.bank_account, '8877665544');

  // Financial Konter: verify pendapatan_asben & total_pendapatan = penjualan + pendapatan_asben
  await financeApi.put(`/api/financial/outlet/${branchId}/2026-11`).send({
    penjualan: 2000000,
    operasional: 150000,
  });
  const finRes = await financeApi.get('/api/financial/outlet?period=2026-11');
  assert.equal(finRes.status, 200);
  const finBranch = finRes.body.data.find((r) => r.branch_id === branchId);
  assert.ok(finBranch);
  assert.ok(finBranch.pendapatan_asben > 0, 'Konter report must reflect ASBEN income');
  assert.equal(finBranch.total_pendapatan, finBranch.penjualan + finBranch.pendapatan_asben);

  // Branch update preserves employee_count, delete fails when employees/financial history exist
  const updBranch = await masterApi.put(`/api/branches/${branchId}`).send({
    code: 'QA-AP1',
    name: 'Konter Absen Updated',
    location_type: 'Konter',
    rent_amount: 600000,
    status: 'Active',
  });
  assert.equal(updBranch.status, 200);
  assert.equal(updBranch.body.data.employee_count, 1);

  const delBranch = await masterApi.delete(`/api/branches/${branchId}`);
  assert.equal(delBranch.status, 400);
});

test('recruitment stages: stage 2 JSON, ref_check_notes, reject score preservation, onboarding & promote', async () => {
  const brRes = await masterApi.post('/api/branches').send({
    code: 'QA-RC1',
    name: 'Konter Rekrutmen QA',
  });
  assert.equal(brRes.status, 200);
  const branchId = brRes.body.data.id;

  // Candidate A: full pipeline -> Hired -> Onboarding -> Promote to staff
  const candA = await staffApi.post('/api/candidates').send({
    name: 'Kandidat Pipeline QA',
    nik: '3201010101930003',
    phone: '081333444555',
    branch_id: branchId,
  });
  assert.equal(candA.status, 201);
  const candAId = candA.body.candidateId;

  assert.equal((await staffApi.put(`/api/candidates/${candAId}/stage/1`).send({ berkas_lengkap: true, passed: true })).status, 200);
  assert.equal((await staffApi.put(`/api/candidates/${candAId}/stage/2`).send({
    score_numerik: 85,
    score_situasional: 80,
    score_pengetahuan: 75,
    score_nominal: 90,
    score_kepribadian: [{ trait: 'Layanan', score: 9 }],
    total_score: 82,
    passed: true,
  })).status, 200);
  assert.equal((await staffApi.put(`/api/candidates/${candAId}/stage/3`).send({ score_upselling: 8, passed: true })).status, 200);
  assert.equal((await staffApi.put(`/api/candidates/${candAId}/stage/4`).send({ score_integritas: 8, passed: true })).status, 200);
  assert.equal((await staffApi.put(`/api/candidates/${candAId}/stage/5`).send({ decision: 'Diterima', passed: true })).status, 200);
  assert.equal((await staffApi.put(`/api/candidates/${candAId}/stage/6`).send({
    score_training: 88,
    mcu_buta_warna: true,
    ref_check_verified: true,
    ref_check_notes: 'Referensi sangat baik',
    passed: true,
  })).status, 200);
  const s7Res = await staffApi.put(`/api/candidates/${candAId}/stage/7`).send({
    contract_type: 'PKWT',
    salary_offered: 2800000,
    allowance: 200000,
    offering_status: 'Accepted',
    passed: true,
  });
  assert.equal(s7Res.status, 200);
  assert.equal(s7Res.body.status, 'Hired');

  // Onboarding explicit stage key
  const obRes = await staffApi.put(`/api/candidates/${candAId}/stage/onboarding`).send({
    day_30_status: 'Lulus',
    day_30_score: 91,
    day_30_notes: 'Adaptasi cepat',
  });
  assert.equal(obRes.status, 200);

  const detA = await staffApi.get(`/api/candidates/${candAId}`);
  assert.equal(detA.status, 200);
  assert.equal(detA.body.candidate.stage2.score_numerik, 85);
  assert.ok(String(detA.body.candidate.stage2.score_kepribadian).includes('Layanan'));
  assert.equal(detA.body.candidate.stage6.ref_check_notes, 'Referensi sangat baik');
  assert.equal(detA.body.candidate.onboarding.day_30_score, 91);

  // Promote hired candidate to staff
  const promoRes = await financeApi.post(`/api/staff/promote/${candAId}`).send({
    employee_type: 'Frontliner',
    position: 'Kasir',
  });
  assert.equal(promoRes.status, 200);
  const promoStaff = await financeApi.get(`/api/staff/${promoRes.body.employeeId}`);
  assert.equal(promoStaff.body.data.salary, 2800000);
  assert.equal(promoStaff.body.data.allowance, 200000);

  // Candidate B: reject preserves stage 2 scores
  const candB = await staffApi.post('/api/candidates').send({ name: 'Kandidat Reject QA', branch_id: branchId });
  assert.equal(candB.status, 201);
  const candBId = candB.body.candidateId;
  await staffApi.put(`/api/candidates/${candBId}/stage/1`).send({ berkas_lengkap: true, passed: true });
  await staffApi.put(`/api/candidates/${candBId}/stage/2`).send({ score_numerik: 77, total_score: 77, passed: true });
  const rejRes = await staffApi.put(`/api/candidates/${candBId}/stage/3`).send({ status: 'Rejected' });
  assert.equal(rejRes.status, 200);
  assert.equal(rejRes.body.status, 'Rejected');
  const detB = await staffApi.get(`/api/candidates/${candBId}`);
  assert.equal(detB.body.candidate.stage2.score_numerik, 77, 'Rejection must preserve prior stage scores');
});

test('settings penalty rules reject max_count < min_count', async () => {
  const badRule = await masterApi.post('/api/settings/penalty-rules').send({
    min_count: 5,
    max_count: 3,
    penalty_per_occurrence: 25000,
  });
  assert.equal(badRule.status, 400);
});
