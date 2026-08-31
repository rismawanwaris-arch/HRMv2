const { app, request, dbReady, login } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

test.before(() => dbReady());

test('login rejects wrong credentials', async () => {
  const res = await request(app).post('/api/login').send({ username: 'admin', password: 'nope' });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('login rejects missing fields', async () => {
  const res = await request(app).post('/api/login').send({ username: 'admin' });
  assert.equal(res.status, 400);
});

test('login succeeds with seeded admin and returns a token', async () => {
  const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.username, 'admin');
});

test('protected route requires a token', async () => {
  const res = await request(app).get('/api/candidates');
  assert.equal(res.status, 401);
});

test('protected route rejects a tampered token', async () => {
  const token = await login();
  const res = await request(app)
    .get('/api/candidates')
    .set('Authorization', `Bearer ${token.slice(0, -2)}zz`);
  assert.equal(res.status, 403);
});

test('protected route accepts a valid token', async () => {
  const token = await login();
  const res = await request(app).get('/api/candidates').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('change-password requires authentication', async () => {
  const res = await request(app)
    .post('/api/change-password')
    .send({ oldPassword: 'admin123', newPassword: 'whatever12' });
  assert.equal(res.status, 401);
});

test('change-password enforces a minimum length', async () => {
  const token = await login();
  const res = await request(app)
    .post('/api/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ oldPassword: 'admin123', newPassword: 'short' });
  assert.equal(res.status, 400);
});

test('change-password rejects a wrong current password', async () => {
  const token = await login();
  const res = await request(app)
    .post('/api/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ oldPassword: 'wrong-current', newPassword: 'longenough123' });
  assert.equal(res.status, 401);
});

test('change-password succeeds and the new password works', async () => {
  const token = await login();
  const change = await request(app)
    .post('/api/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ oldPassword: 'admin123', newPassword: 'brand-new-pass-1' });
  assert.equal(change.status, 200);

  const relogin = await request(app).post('/api/login').send({ username: 'admin', password: 'brand-new-pass-1' });
  assert.equal(relogin.status, 200);

  // restore for other assertions within this file run
  await request(app)
    .post('/api/change-password')
    .set('Authorization', `Bearer ${relogin.body.token}`)
    .send({ oldPassword: 'brand-new-pass-1', newPassword: 'admin123' });
});
