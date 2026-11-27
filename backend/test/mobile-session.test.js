const { app, request, dbReady, login, authed } = require('./helpers');
const { query } = require('../db');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

describe('Mobile Session Policy, Tracking & Idle Timeout', () => {
  let masterToken;
  let masterClient;
  let staffUsername;
  let staffPassword = 'StaffPassword123!';
  let staffId;

  before(async () => {
    await dbReady();
    masterToken = await login('admin', 'admin123');
    masterClient = authed(masterToken);

    staffUsername = 'mob_sess_staff_' + Date.now();
    const createRes = await masterClient.post('/api/admins').send({
      username: staffUsername,
      password: staffPassword,
      role: 'staff',
    });
    assert.equal(createRes.status, 200);
    staffId = createRes.body.data.id;
  });

  after(async () => {
    // Reset mobile session policy settings to safe defaults
    await masterClient.put('/api/settings').send({
      mobile_token_ttl_hours: 12,
      mobile_idle_timeout_minutes: 30,
      mobile_app_lock_minutes: 5,
      mobile_offline_cache_ttl_hours: 24,
      mobile_require_app_lock: true,
      mobile_wipe_cache_on_logout: true,
      mobile_allow_offline_read: true,
      mobile_single_device_mode: false,
    });
  });

  it('POST /api/mobile/login records device metadata and returns session_id + session_policy', async () => {
    const loginRes = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_id: 'dev-android-001',
      device_name: 'Samsung Galaxy A54',
      platform: 'android',
      app_version: '2.1.0',
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    assert.ok(loginRes.body.session_id);
    assert.ok(loginRes.body.session_policy);
    assert.equal(loginRes.body.session_policy.idle_timeout_minutes, 30);
    assert.equal(loginRes.body.session_policy.app_lock_minutes, 5);
    assert.equal(loginRes.body.session_policy.wipe_cache_on_logout, true);

    // GET /api/mobile/me returns session_id + live session_policy
    const meRes = await authed(loginRes.body.token).get('/api/mobile/me');
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.session_id, loginRes.body.session_id);
    assert.ok(meRes.body.data.session_policy);
    assert.ok(meRes.body.data.server_time);

    // Master can list active mobile sessions; staff is forbidden (403)
    const staffList = await authed(loginRes.body.token).get('/api/mobile-sessions');
    assert.equal(staffList.status, 403);

    const masterList = await masterClient.get('/api/mobile-sessions');
    assert.equal(masterList.status, 200);
    const found = masterList.body.data.find((s) => s.session_id === loginRes.body.session_id);
    assert.ok(found, 'Logged-in mobile session must appear in /api/mobile-sessions');
    assert.equal(found.device_name, 'Samsung Galaxy A54');
    assert.equal(found.platform, 'android');
    assert.equal(found.status, 'active');
  });

  it('PUT /api/settings validates & persists mobile session policy and exposes it in /api/settings/mobile-config', async () => {
    // Reject out-of-range values
    const badRes = await masterClient.put('/api/settings').send({
      mobile_idle_timeout_minutes: 0,
    });
    assert.equal(badRes.status, 400);

    const badTtl = await masterClient.put('/api/settings').send({
      mobile_token_ttl_hours: 999,
    });
    assert.equal(badTtl.status, 400);

    // Valid update
    const okRes = await masterClient.put('/api/settings').send({
      mobile_token_ttl_hours: 8,
      mobile_idle_timeout_minutes: 15,
      mobile_app_lock_minutes: 3,
      mobile_offline_cache_ttl_hours: 12,
      mobile_require_app_lock: true,
      mobile_wipe_cache_on_logout: true,
      mobile_allow_offline_read: false,
      mobile_single_device_mode: false,
    });
    assert.equal(okRes.status, 200);

    const cfgRes = await masterClient.get('/api/settings/mobile-config');
    assert.equal(cfgRes.status, 200);
    assert.equal(cfgRes.body.data.session_policy.token_ttl_hours, 8);
    assert.equal(cfgRes.body.data.session_policy.idle_timeout_minutes, 15);
    assert.equal(cfgRes.body.data.session_policy.app_lock_minutes, 3);
    assert.equal(cfgRes.body.data.session_policy.offline_cache_ttl_hours, 12);
    assert.equal(cfgRes.body.data.session_policy.allow_offline_read, false);
    assert.ok(cfgRes.body.data.active_mobile_sessions >= 1);
  });

  it('POST /api/mobile/session/refresh issues a fresh token for an active mobile session', async () => {
    const loginRes = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_name: 'Pixel 8',
      platform: 'android',
    });
    assert.equal(loginRes.status, 200);

    const refreshRes = await authed(loginRes.body.token).post('/api/mobile/session/refresh').send({});
    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.body.success, true);
    assert.ok(refreshRes.body.token);
    assert.equal(refreshRes.body.session_id, loginRes.body.session_id);
    assert.ok(refreshRes.body.expires_at);
    assert.ok(refreshRes.body.session_policy);

    const meRes = await authed(refreshRes.body.token).get('/api/mobile/me');
    assert.equal(meRes.status, 200);
  });

  it('Server-side idle timeout rejects inactive mobile session with 401 SESSION_IDLE_TIMEOUT', async () => {
    const loginRes = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_name: 'Idle Device',
      platform: 'android',
    });
    assert.equal(loginRes.status, 200);
    const sid = loginRes.body.session_id;

    // Backdate last_active_at by 60 minutes (> 15 min configured idle timeout)
    const oldIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await query.run('UPDATE mobile_sessions SET last_active_at = ? WHERE session_id = ?', [oldIso, sid]);

    const res = await authed(loginRes.body.token).get('/api/mobile/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'SESSION_IDLE_TIMEOUT');

    // Subsequent call must remain rejected (session marked revoked)
    const res2 = await authed(loginRes.body.token).get('/api/mobile/me');
    assert.equal(res2.status, 401);
    assert.equal(res2.body.code, 'SESSION_REVOKED');
  });

  it('single_device_mode revokes previous mobile device session on new login', async () => {
    await masterClient.put('/api/settings').send({ mobile_single_device_mode: true });

    const devA = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_name: 'HP Lama A',
      platform: 'android',
    });
    assert.equal(devA.status, 200);

    const devB = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_name: 'HP Baru B',
      platform: 'android',
    });
    assert.equal(devB.status, 200);

    // HP Lama A is revoked, HP Baru B stays active
    const checkA = await authed(devA.body.token).get('/api/mobile/me');
    assert.equal(checkA.status, 401);
    assert.equal(checkA.body.code, 'SESSION_REVOKED');

    const checkB = await authed(devB.body.token).get('/api/mobile/me');
    assert.equal(checkB.status, 200);

    await masterClient.put('/api/settings').send({ mobile_single_device_mode: false });
  });

  it('Master admin can revoke a single mobile session or revoke all active mobile sessions', async () => {
    const dev1 = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_name: 'Device One',
      platform: 'android',
    });
    const dev2 = await request(app).post('/api/mobile/login').send({
      username: staffUsername,
      password: staffPassword,
      device_name: 'Device Two',
      platform: 'ios',
    });
    assert.equal(dev1.status, 200);
    assert.equal(dev2.status, 200);

    // Revoke only dev1
    const rev1 = await masterClient.post(`/api/mobile-sessions/${dev1.body.session_id}/revoke`).send({});
    assert.equal(rev1.status, 200);

    assert.equal((await authed(dev1.body.token).get('/api/mobile/me')).status, 401);
    assert.equal((await authed(dev2.body.token).get('/api/mobile/me')).status, 200);

    // Revoke all remaining mobile sessions
    const revAll = await masterClient.post('/api/mobile-sessions/revoke-all').send({});
    assert.equal(revAll.status, 200);
    assert.ok(revAll.body.revoked_count >= 1);

    const afterRevAll = await authed(dev2.body.token).get('/api/mobile/me');
    assert.equal(afterRevAll.status, 401);
    assert.equal(afterRevAll.body.code, 'SESSION_REVOKED');
  });
});
