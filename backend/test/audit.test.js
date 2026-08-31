const { dbReady, login, authed } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

let api;

test.before(async () => {
  await dbReady();
  api = authed(await login());
});

test('mutations are recorded, reads are not', async () => {
  const before = (await api.get('/api/audit-log?limit=1')).body.total;

  const created = await api.post('/api/candidates').send({ name: 'Audited Candidate' });
  const id = created.body.candidateId;
  await api.put(`/api/candidates/${id}`).send({ name: 'Audited Candidate v2', phone: '0811' });
  await api.get(`/api/candidates/${id}`); // read — must NOT be logged
  await api.delete(`/api/candidates/${id}`);

  const res = await api.get('/api/audit-log?entity_type=candidates&limit=50');
  assert.equal(res.status, 200);
  const forThis = res.body.data.filter((e) => e.entity_id === id);
  const actions = forThis.map((e) => e.action).sort();
  assert.deepEqual(actions, ['candidates.create', 'candidates.delete', 'candidates.update']);
  assert.ok(forThis.every((e) => e.actor === 'admin'));
  assert.ok(forThis.every((e) => e.method !== 'GET'));

  assert.equal((await api.get('/api/audit-log?limit=1')).body.total, before + 3);
});

test('audit detail records touched field names but not values', async () => {
  const created = await api.post('/api/candidates').send({ name: 'Field Names', nik: '1231231231231231' });
  const entry = (await api.get(`/api/audit-log?entity_type=candidates&entity_id=${created.body.candidateId}`)).body.data[0];
  const detail = JSON.parse(entry.detail);
  assert.ok(detail.bodyKeys.includes('name'));
  assert.ok(detail.bodyKeys.includes('nik'));
  assert.equal(detail.bodyKeys.includes('1231231231231231'), false);
});

test('change-password is audited without leaking the passwords', async () => {
  const token = await login();
  await require('./helpers').request(require('../app'))
    .post('/api/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ oldPassword: 'admin123', newPassword: 'temp-password-9' });

  const res = await api.get('/api/audit-log?limit=10');
  const entry = res.body.data.find((e) => e.path === '/api/change-password');
  assert.ok(entry, 'change-password call was logged');
  const detail = JSON.parse(entry.detail);
  assert.deepEqual(detail.bodyKeys, []); // oldPassword / newPassword are stripped

  // restore
  const relogin = await require('./helpers').request(require('../app'))
    .post('/api/login').send({ username: 'admin', password: 'temp-password-9' });
  await require('./helpers').request(require('../app'))
    .post('/api/change-password')
    .set('Authorization', `Bearer ${relogin.body.token}`)
    .send({ oldPassword: 'temp-password-9', newPassword: 'admin123' });
});

test('audit-log endpoint requires auth', async () => {
  const res = await require('./helpers').request(require('../app')).get('/api/audit-log');
  assert.equal(res.status, 401);
});
