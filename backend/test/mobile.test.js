const { app, request, dbReady, login, authed } = require('./helpers');
const { getPeriodForDate } = require('../utils/payrollCalc');
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

describe('Mobile Sync & HRGA Endpoints', () => {
  let token;
  let client;
  let branchId;

  before(async () => {
    await dbReady();
    token = await login('admin', 'admin123');
    client = authed(token);

    // Create a branch so foreign key constraint succeeds
    const branchRes = await client.post('/api/branches').send({
      code: 'MBL-01',
      name: 'Cabang Mobile Test',
      city: 'Bandung'
    });
    branchId = branchRes.body.data.id;
  });

  it('GET /api/mobile/master-data should return branches and dropdown choices', async () => {
    const res = await client.get('/api/mobile/master-data');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.branches));
    assert.ok(res.body.data.branches.length > 0);
    assert.ok(res.body.data.categories.includes('Elektronik'));
    assert.ok(res.body.data.asset_conditions.includes('Baik'));
  });

  it('POST /api/mobile/sync/asset should save new asset and handle idempotency', async () => {
    const testUuid = 'test-uuid-asset-' + Date.now();
    const assetPayload = {
      client_uuid: testUuid,
      name: 'Mobile Test Printer',
      category: 'Elektronik',
      branch_id: branchId,
      condition: 'Baik',
      status: 'Aktif',
      brand: 'Epson',
      purchase_cost: 2500000,
      notes: 'Initial test asset from mobile'
    };

    // 1st sync (Insert)
    const res1 = await client.post('/api/mobile/sync/asset').send(assetPayload);
    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.data.client_uuid, testUuid);
    const serverId = res1.body.data.server_id;
    assert.ok(serverId > 0);

    // 2nd sync (Idempotent replay with same client_uuid)
    const res2 = await client.post('/api/mobile/sync/asset').send(assetPayload);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.success, true);
    assert.equal(res2.body.data.server_id, serverId);
    assert.match(res2.body.message, /idempotent/i);
  });

  it('POST /api/mobile/sync/visit should save visit and handle idempotency', async () => {
    const testUuid = 'test-uuid-visit-' + Date.now();
    const visitPayload = {
      client_uuid: testUuid,
      branch_id: branchId,
      visitor_name: 'Budi Lapangan',
      purpose: 'Inspeksi Aset Mingguan',
      score_cleanliness: 90,
      notes: 'Kondisi outlet terawat'
    };

    const res1 = await client.post('/api/mobile/sync/visit').send(visitPayload);
    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.data.client_uuid, testUuid);

    // Idempotent retry
    const res2 = await client.post('/api/mobile/sync/visit').send(visitPayload);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.client_uuid, testUuid);
  });

  it('POST /api/mobile/sync/employee should save employee and handle idempotency', async () => {
    const testUuid = 'test-uuid-emp-' + Date.now();
    const empPayload = {
      client_uuid: testUuid,
      name: 'Staf Lapangan Baru',
      branch_id: branchId,
      phone: '081299990001',
      contract_type: 'PKWT'
    };

    const res1 = await client.post('/api/mobile/sync/employee').send(empPayload);
    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    assert.ok(res1.body.data.server_id > 0);
    assert.equal(res1.body.data.candidate_id, res1.body.data.server_id);
    assert.ok(res1.body.data.employee_id > 0, 'syncEmployee must return employee_id');

    // Idempotent retry
    const res2 = await client.post('/api/mobile/sync/employee').send(empPayload);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.server_id, res1.body.data.server_id);
    assert.equal(res2.body.data.candidate_id, res1.body.data.candidate_id);
    assert.equal(res2.body.data.employee_id, res1.body.data.employee_id);
  });

  it('GET /api/mobile/assets and /api/mobile/employees should return filtered results', async () => {
    const assetsRes = await client.get('/api/mobile/assets?search=Mobile Test Printer');
    assert.equal(assetsRes.status, 200);
    assert.ok(assetsRes.body.data.length > 0);

    const empRes = await client.get('/api/mobile/employees?search=Staf Lapangan Baru');
    assert.equal(empRes.status, 200);
    assert.ok(empRes.body.data.length > 0);
  });

  it('POST /api/mobile/login should return user object and token', async () => {
    const res = await client.post('/api/mobile/login').send({ username: 'admin', password: 'admin123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.ok(res.body.message);
    assert.equal(res.body.user.username, 'admin');
    assert.ok(res.body.user.role);
  });

  it('GET /api/master-data (alias) should work and include branch phone field', async () => {
    const res = await client.get('/api/master-data');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.branches));
    assert.ok('phone' in res.body.data.branches[0]);
  });

  it('POST /api/sync/asset (alias without /mobile) should succeed', async () => {
    const res = await client.post('/api/sync/asset').send({
      client_uuid: 'alias-test-uuid-' + Date.now(),
      name: 'Printer Alias Test',
      category: 'Elektronik',
      branch_id: branchId
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Aset berhasil disinkronkan ke server.');
  });

  it('Unknown API routes should strictly return JSON 404 and never HTML', async () => {
    const res = await client.get('/api/this-route-does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.headers['content-type'].includes('application/json'), true);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /tidak ditemukan/i);
  });

  it('Security: unauthenticated requests to /api/master-data and /api/mobile/sync/* must be rejected with 401', async () => {
    const r1 = await request(app).get('/api/master-data');
    assert.equal(r1.status, 401);

    const r2 = await request(app).get('/api/mobile/master-data');
    assert.equal(r2.status, 401);

    const r3 = await request(app).post('/api/mobile/sync/employee').send({
      client_uuid: 'unauth-uuid-12345678',
      name: 'Hacker'
    });
    assert.equal(r3.status, 401);
  });

  it('Security: invalid client_uuid or NIK format is rejected with 400', async () => {
    const badUuidRes = await client.post('/api/mobile/sync/asset').send({
      client_uuid: 'bad; DROP TABLE outlet_assets;--',
      name: 'Bad Asset',
      category: 'Elektronik',
      branch_id: branchId
    });
    assert.equal(badUuidRes.status, 400);

    const badNikRes = await client.post('/api/mobile/sync/employee').send({
      client_uuid: 'valid-uuid-nik-test-123',
      name: 'Invalid NIK Test',
      nik: 'ABC-NOT-DIGITS',
      branch_id: branchId
    });
    assert.equal(badNikRes.status, 400);
  });

  it('Security: spoofed non-image file disguised as .jpg is rejected by magic-byte check', async () => {
    const fakeHtmlBuffer = Buffer.from('<html><script>alert(1)</script></html>', 'utf-8');
    const spoofRes = await client
      .post('/api/mobile/sync/asset')
      .field('client_uuid', 'spoof-test-uuid-' + Date.now())
      .field('name', 'Spoofed Photo Asset')
      .field('category', 'Elektronik')
      .field('branch_id', String(branchId))
      .attach('photos', fakeHtmlBuffer, { filename: 'exploit.jpg', contentType: 'image/jpeg' });
    assert.equal(spoofRes.status, 400);
    assert.match(spoofRes.body.message, /bukan gambar asli/i);

    // Valid JPEG magic header (FF D8 FF E0) succeeds
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const validRes = await client
      .post('/api/mobile/sync/asset')
      .field('client_uuid', 'valid-jpg-uuid-' + Date.now())
      .field('name', 'Valid Photo Asset')
      .field('category', 'Elektronik')
      .field('branch_id', String(branchId))
      .attach('photos', validJpegBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    assert.equal(validRes.status, 201);
  });

  it('Security: GET /api/mobile/employees does not leak sensitive PII (NIK, salary, bank)', async () => {
    const empRes = await client.get('/api/mobile/employees');
    assert.equal(empRes.status, 200);
    for (const emp of empRes.body.data) {
      assert.equal('nik' in emp, false);
      assert.equal('nik_bidx' in emp, false);
      assert.equal('salary_offered' in emp, false);
      assert.equal('bank_account_number' in emp, false);
      assert.equal('address_ktp' in emp, false);
    }
  });

  it('API v2.0: health, me, no ghost /mobile/mobile prefix, master-data SunFish fields & unified SunFish mobile endpoints', async () => {
    // Public health check
    const healthRes = await request(app).get('/api/mobile/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.success, true);
    assert.equal(healthRes.body.api_version, '2.0');

    // /me requires auth & returns permissions
    const meNoAuth = await request(app).get('/api/mobile/me');
    assert.equal(meNoAuth.status, 401);

    const meRes = await client.get('/api/mobile/me');
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.username, 'admin');
    assert.equal(meRes.body.data.permissions.can_approve, true);

    // Ghost double prefix must be 404 JSON
    const ghostRes = await request(app).post('/api/mobile/mobile/login').send({ username: 'admin', password: 'admin123' });
    assert.equal(ghostRes.status, 404);
    assert.equal(ghostRes.body.success, false);

    // Master data includes SunFish leave_types, shift_cutoffs, reimbursement_categories, and branch geofence fields
    const mdRes = await client.get('/api/mobile/master-data');
    assert.equal(mdRes.status, 200);
    assert.ok(Array.isArray(mdRes.body.data.leave_types) && mdRes.body.data.leave_types.length > 0);
    assert.ok(Array.isArray(mdRes.body.data.reimbursement_categories));
    assert.ok(mdRes.body.data.shift_cutoffs && mdRes.body.data.shift_cutoffs.pagi && mdRes.body.data.shift_cutoffs.siang);
    assert.ok('geofence_radius_m' in mdRes.body.data.branches[0]);

    // Sync an employee cleanly and use its returned employee_id for unified mobile HR calls
    const syncEmp = await client.post('/api/mobile/sync/employee').send({
      client_uuid: 'mobile-v2-emp-' + Date.now(),
      name: 'Karyawan Mobile V2',
      branch_id: branchId,
      salary_offered: 3500000,
    });
    assert.equal(syncEmp.status, 201);
    const empId = syncEmp.body.data.employee_id;
    assert.ok(empId > 0);

    // Create staff role user to verify unified mobile endpoints & RBAC
    const staffUser = 'mbl_staff_' + Date.now();
    await client.post('/api/admins').send({ username: staffUser, password: 'Password123!', role: 'staff' });
    const staffLogin = await request(app).post('/api/mobile/login').send({ username: staffUser, password: 'Password123!' });
    assert.equal(staffLogin.status, 200);
    const staffClient = authed(staffLogin.body.token);

    const staffMe = await staffClient.get('/api/mobile/me');
    assert.equal(staffMe.status, 200);
    assert.equal(staffMe.body.data.permissions.can_approve, false);

    // Attendance today (no date param defaults to today) + history + check-in
    const attToday = await staffClient.get('/api/mobile/attendance/today');
    assert.equal(attToday.status, 200);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const checkinRes = await staffClient.post('/api/mobile/attendance/checkin').send({
      employee_id: empId,
      shift: 'Pagi',
    });
    assert.equal(checkinRes.status, 200);
    assert.equal(checkinRes.body.data.date, todayStr);

    const currentPeriod = getPeriodForDate(todayStr, 29, 28);
    const attHist = await staffClient.get(`/api/mobile/attendance/history?employee_id=${empId}&period=${currentPeriod}`);
    assert.equal(attHist.status, 200);
    assert.ok(attHist.body.data.some((d) => d.date === todayStr));

    // Leaves & Overtime via /api/mobile/*
    const ltRes = await staffClient.get('/api/mobile/leaves/types');
    assert.equal(ltRes.status, 200);
    const annualType = ltRes.body.data.find((t) => t.code === 'ANNUAL');

    const leaveCreate = await staffClient.post('/api/mobile/leaves/requests').send({
      employee_id: empId,
      leave_type_id: annualType.id,
      start_date: '2026-12-21',
      end_date: '2026-12-21',
      reason: 'Uji mobile API v2',
    });
    assert.equal(leaveCreate.status, 201);
    const leaveId = leaveCreate.body.data.id;

    // Staff blocked 403 on approve; master succeeds
    assert.equal((await staffClient.put(`/api/mobile/leaves/requests/${leaveId}/approve`).send({})).status, 403);
    assert.equal((await client.put(`/api/mobile/leaves/requests/${leaveId}/approve`).send({})).status, 200);

    const otCreate = await staffClient.post('/api/mobile/overtime').send({
      employee_id: empId,
      date: '2026-11-24',
      hours: 2,
      day_type: 'weekday',
      reason: 'Lembur mobile v2',
    });
    assert.equal(otCreate.status, 201);
    const otId = otCreate.body.data.id;
    assert.equal((await staffClient.put(`/api/mobile/overtime/${otId}/approve`).send({})).status, 403);
    assert.equal((await client.put(`/api/mobile/overtime/${otId}/approve`).send({})).status, 200);

    const reimbCreate = await staffClient.post('/api/mobile/reimbursements').send({
      employee_id: empId,
      claim_date: '2026-11-25',
      category: 'Transportasi',
      amount: 45000,
      description: 'Klaim BBM via mobile',
    });
    assert.equal(reimbCreate.status, 201);
    assert.equal((await client.put(`/api/mobile/reimbursements/${reimbCreate.body.data.id}/approve`).send({})).status, 200);
  });
});
