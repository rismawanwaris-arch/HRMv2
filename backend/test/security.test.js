const { app, request, dbReady, login, authed } = require('./helpers');
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

function getLocalTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('Security Hardening & Regression Suite', () => {
  let masterToken;
  let masterClient;
  let staffToken;
  let staffClient;
  let branchId;
  let employeeId;

  before(async () => {
    await dbReady();
    masterToken = await login('admin', 'admin123');
    masterClient = authed(masterToken);

    const branchRes = await masterClient.post('/api/branches').send({
      code: 'SEC-01',
      name: 'Cabang Security Test',
      city: 'Bandung',
      latitude: -6.2,
      longitude: 106.816666,
      geofence_radius_m: 200,
    });
    assert.equal(branchRes.status, 200);
    branchId = branchRes.body.data.id;

    const empRes = await masterClient.post('/api/staff').send({
      name: 'Karyawan Security QA',
      branch_id: branchId,
      employee_type: 'Frontliner',
      salary: 3200000,
    });
    assert.equal(empRes.status, 200);
    employeeId = empRes.body.employeeId;

    const staffUsername = 'sec_staff_' + Date.now();
    const createStaff = await masterClient.post('/api/admins').send({
      username: staffUsername,
      password: 'Password123!',
      role: 'staff',
    });
    assert.equal(createStaff.status, 200);

    const staffLogin = await request(app)
      .post('/api/mobile/login')
      .send({ username: staffUsername, password: 'Password123!' });
    assert.equal(staffLogin.status, 200);
    assert.ok(staffLogin.body.expires_in > 0);
    assert.ok(staffLogin.body.expires_at);
    staffToken = staffLogin.body.token;
    staffClient = authed(staffToken);
  });

  it('SEC-01: /docs static endpoint requires master authentication', async () => {
    const noAuth = await request(app).get('/docs/FLUTTER_API_INTEGRATION_GUIDE.md');
    assert.equal(noAuth.status, 401);

    const staffDocs = await staffClient.get('/docs/FLUTTER_API_INTEGRATION_GUIDE.md');
    assert.equal(staffDocs.status, 403);

    const masterDocs = await masterClient.get('/docs/FLUTTER_API_INTEGRATION_GUIDE.md');
    assert.equal(masterDocs.status, 200);
  });

  it('SEC-02: ?token= query param is rejected on JSON APIs, allowed only on media/download GETs, and /api sets Cache-Control: no-store', async () => {
    const empQueryRes = await request(app).get(`/api/employees?token=${encodeURIComponent(masterToken)}`);
    assert.equal(empQueryRes.status, 401);
    assert.equal(empQueryRes.body.code, 'TOKEN_MISSING');
    assert.match(empQueryRes.headers['cache-control'] || '', /no-store/);
    assert.equal(empQueryRes.headers['referrer-policy'], 'no-referrer');

    const mdQueryRes = await request(app).get(`/api/mobile/master-data?token=${encodeURIComponent(masterToken)}`);
    assert.equal(mdQueryRes.status, 401);
    assert.equal(mdQueryRes.body.code, 'TOKEN_MISSING');

    // Allowed binary photo route accepts ?token= (passes auth -> reaches handler -> 404 nonexistent file)
    const photoQueryRes = await request(app).get(`/api/mobile/photos/nonexistent.jpg?token=${encodeURIComponent(masterToken)}`);
    assert.equal(photoQueryRes.status, 404);
  });

  it('SEC-03: mobile logout, password change, and master session revocation invalidate active tokens immediately', async () => {
    const tempUser = 'sec_rev_' + Date.now();
    const createRes = await masterClient.post('/api/admins').send({
      username: tempUser,
      password: 'Password123!',
      role: 'staff',
    });
    assert.equal(createRes.status, 200);
    const tempUserId = createRes.body.data.id;

    // 1. Mobile logout revokes token
    const login1 = await request(app).post('/api/mobile/login').send({ username: tempUser, password: 'Password123!' });
    assert.equal(login1.status, 200);
    const t1 = login1.body.token;
    assert.equal((await authed(t1).get('/api/mobile/me')).status, 200);

    const logoutRes = await authed(t1).post('/api/mobile/logout').send({});
    assert.equal(logoutRes.status, 200);

    const afterLogout = await authed(t1).get('/api/mobile/me');
    assert.equal(afterLogout.status, 401);
    assert.equal(afterLogout.body.code, 'SESSION_REVOKED');

    // 2. Password change revokes token issued before password change
    const login2 = await request(app).post('/api/mobile/login').send({ username: tempUser, password: 'Password123!' });
    assert.equal(login2.status, 200);
    const t2 = login2.body.token;

    const chgRes = await authed(t2).post('/api/change-password').send({
      oldPassword: 'Password123!',
      newPassword: 'NewPassword456!',
    });
    assert.equal(chgRes.status, 200);

    const afterChg = await authed(t2).get('/api/mobile/me');
    assert.equal(afterChg.status, 401);
    assert.equal(afterChg.body.code, 'SESSION_REVOKED');

    // 3. Master admin revoke-sessions revokes target user's mobile session; staff cannot call revoke-sessions
    const login3 = await request(app).post('/api/mobile/login').send({ username: tempUser, password: 'NewPassword456!' });
    assert.equal(login3.status, 200);
    const t3 = login3.body.token;

    const staffRevokeAttempt = await staffClient.post(`/api/admins/${tempUserId}/revoke-sessions`).send({});
    assert.equal(staffRevokeAttempt.status, 403);

    const masterRevoke = await masterClient.post(`/api/admins/${tempUserId}/revoke-sessions`).send({});
    assert.equal(masterRevoke.status, 200);

    const afterRevoke = await authed(t3).get('/api/mobile/me');
    assert.equal(afterRevoke.status, 401);
    assert.equal(afterRevoke.body.code, 'SESSION_REVOKED');
  });

  it('SEC-04: staff cannot sync/register employees, check-in enforces server clock & GPS bounds, settings validate mobile URL, and X-Mobile-App-Key is enforced when configured', async () => {
    const meStaff = await staffClient.get('/api/mobile/me');
    assert.equal(meStaff.status, 200);
    assert.equal(meStaff.body.data.permissions.can_register_employee, false);

    const meMaster = await masterClient.get('/api/mobile/me');
    assert.equal(meMaster.status, 200);
    assert.equal(meMaster.body.data.permissions.can_register_employee, true);

    const staffSync1 = await staffClient.post('/api/mobile/sync/employee').send({
      client_uuid: 'staff-blocked-sync-' + Date.now(),
      name: 'Blocked Staff Sync',
      branch_id: branchId,
    });
    assert.equal(staffSync1.status, 403);
    assert.equal(staffSync1.body.code, 'FORBIDDEN_ROLE');

    const staffSync2 = await staffClient.post('/api/sync/employee').send({
      client_uuid: 'staff-blocked-alias-' + Date.now(),
      name: 'Blocked Staff Alias',
      branch_id: branchId,
    });
    assert.equal(staffSync2.status, 403);
    assert.equal(staffSync2.body.code, 'FORBIDDEN_ROLE');

    // Out-of-bounds GPS coordinates rejected with 400
    const badGps = await staffClient.post('/api/mobile/attendance/checkin').send({
      employee_id: employeeId,
      shift: 'Pagi',
      latitude: 999,
      longitude: 106.816666,
    });
    assert.equal(badGps.status, 400);

    // Staff cannot spoof historical date or check-in time
    const todayStr = getLocalTodayStr();
    const spoofCheckin = await staffClient.post('/api/mobile/attendance/checkin').send({
      employee_id: employeeId,
      shift: 'Pagi',
      latitude: -6.2,
      longitude: 106.816666,
      date: '2020-01-01',
      check_in_time: '05:00',
    });
    assert.equal(spoofCheckin.status, 200);
    assert.equal(spoofCheckin.body.data.date, todayStr);

    // mobile_api_base_url validation blocks dangerous or public HTTP origins
    const badUrl1 = await masterClient.put('/api/settings').send({ mobile_api_base_url: 'javascript:alert(1)' });
    assert.equal(badUrl1.status, 400);
    const badUrl2 = await masterClient.put('/api/settings').send({ mobile_api_base_url: 'http://evil.example.com/api' });
    assert.equal(badUrl2.status, 400);
    const okHttps = await masterClient.put('/api/settings').send({ mobile_api_base_url: 'https://hr.example.com/api' });
    assert.equal(okHttps.status, 200);
    const okTailscale = await masterClient.put('/api/settings').send({ mobile_api_base_url: 'http://100.103.255.45:5002/api' });
    assert.equal(okTailscale.status, 200);
    await masterClient.put('/api/settings').send({ mobile_api_base_url: '' });

    // Optional X-Mobile-App-Key attestation
    const prevKey = process.env.MOBILE_API_KEY;
    process.env.MOBILE_API_KEY = 'test-app-key-987654321';
    try {
      const hRes = await request(app).get('/api/mobile/health');
      assert.equal(hRes.status, 200);
      assert.equal(hRes.body.app_key_required, true);

      const noKey = await request(app).post('/api/mobile/login').send({ username: 'admin', password: 'admin123' });
      assert.equal(noKey.status, 403);
      assert.equal(noKey.body.code, 'INVALID_APP_KEY');

      const wrongKey = await request(app)
        .post('/api/mobile/login')
        .set('X-Mobile-App-Key', 'wrong-key')
        .send({ username: 'admin', password: 'admin123' });
      assert.equal(wrongKey.status, 403);
      assert.equal(wrongKey.body.code, 'INVALID_APP_KEY');

      const validKey = await request(app)
        .post('/api/mobile/login')
        .set('X-Mobile-App-Key', 'test-app-key-987654321')
        .send({ username: 'admin', password: 'admin123' });
      assert.equal(validKey.status, 200);
    } finally {
      if (prevKey === undefined) delete process.env.MOBILE_API_KEY;
      else process.env.MOBILE_API_KEY = prevKey;
    }
  });

  it('SEC-06: untrusted browser Origin is never reflected in Access-Control-Allow-Origin', async () => {
    const res = await request(app)
      .get('/api/mobile/health')
      .set('Origin', 'https://evil.example.com');
    assert.equal(res.status, 200);
    const acao = res.headers['access-control-allow-origin'];
    assert.notEqual(acao, 'https://evil.example.com');
    assert.notEqual(acao, '*');
  });

  it('SEC-07: spoofed non-image upload is rejected by magic-byte guard on outlet-activity & assets routes', async () => {
    const fakeHtmlBuffer = Buffer.from('<html><script>alert(1)</script></html>', 'utf-8');

    const visitSpoof = await staffClient
      .post('/api/outlet-activity/visits')
      .field('branch_id', String(branchId))
      .field('visit_date', getLocalTodayStr())
      .field('purpose', 'Security Upload Test')
      .attach('photos', fakeHtmlBuffer, { filename: 'bad.jpg', contentType: 'image/jpeg' });
    assert.equal(visitSpoof.status, 400);
    assert.match(visitSpoof.body.message, /bukan gambar asli/i);

    const assetSpoof = await staffClient
      .post('/api/assets')
      .field('name', 'Asset Spoof Test')
      .field('category', 'Elektronik')
      .field('branch_id', String(branchId))
      .attach('photos', fakeHtmlBuffer, { filename: 'bad.jpg', contentType: 'image/jpeg' });
    assert.equal(assetSpoof.status, 400);
    assert.match(assetSpoof.body.message, /bukan gambar asli/i);

    const reimbSpoof = await staffClient
      .post('/api/claims/reimbursements')
      .field('employee_id', String(employeeId))
      .field('claim_date', getLocalTodayStr())
      .field('category', 'Transportasi')
      .field('amount', '25000')
      .attach('receipt', fakeHtmlBuffer, { filename: 'receipt.jpg', contentType: 'image/jpeg' });
    assert.equal(reimbSpoof.status, 400);
    assert.match(reimbSpoof.body.message, /bukan gambar asli/i);

    const docSpoof = await staffClient
      .post('/api/candidates/parse-cv')
      .attach('file', fakeHtmlBuffer, { filename: 'cv.pdf', contentType: 'application/pdf' });
    assert.equal(docSpoof.status, 400);
    assert.match(docSpoof.body.message, /bukan file asli/i);
  });

  it('SEC-08: staff cannot modify payroll cash_advance/fake_money or trigger period sync', async () => {
    const recRes = await staffClient
      .put(`/api/attendance/record/${employeeId}/2026-11`)
      .send({ cash_advance: 500000, fake_money: 100000 });
    assert.equal(recRes.status, 403);
    assert.equal(recRes.body.code, 'FORBIDDEN_ROLE');

    const syncRes = await staffClient
      .post('/api/attendance/sync/2026-11')
      .send({});
    assert.equal(syncRes.status, 403);
    assert.equal(syncRes.body.code, 'FORBIDDEN_ROLE');

    // Master is allowed
    const masterRecRes = await masterClient
      .put(`/api/attendance/record/${employeeId}/2026-11`)
      .send({ cash_advance: 100000, fake_money: 0 });
    assert.equal(masterRecRes.status, 200);
    assert.equal(masterRecRes.body.success, true);
  });
});
