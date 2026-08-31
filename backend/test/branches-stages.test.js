const { dbReady, login, authed } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

let api;

test.before(async () => {
  await dbReady();
  api = authed(await login());
});

test('branch CRUD lifecycle', async () => {
  const create = await api.post('/api/branches').send({ code: 'bdg01', name: 'Bandung Kota', city: 'Bandung' });
  assert.equal(create.status, 200);
  assert.equal(create.body.data.code, 'BDG01', 'code is upper-cased');
  const id = create.body.data.id;

  const dup = await api.post('/api/branches').send({ code: 'bdg01', name: 'Another' });
  assert.equal(dup.status, 400);

  const update = await api.put(`/api/branches/${id}`).send({ code: 'BDG01', name: 'Bandung Pusat', city: 'Bandung' });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.name, 'Bandung Pusat');

  const list = await api.get('/api/branches');
  assert.ok(list.body.data.some((b) => b.id === id));

  const del = await api.delete(`/api/branches/${id}`);
  assert.equal(del.status, 200);
});

test('branch create requires code and name', async () => {
  const res = await api.post('/api/branches').send({ name: 'No Code' });
  assert.equal(res.status, 400);
});

test('built-in stages cannot be deleted, only custom ones', async () => {
  const stages = (await api.get('/api/stages')).body.data;
  const builtIn = stages.find((s) => s.code === 'admin');
  const res = await api.delete(`/api/stages/${builtIn.id}`);
  assert.equal(res.status, 400);

  const custom = await api.post('/api/stages').send({ name: 'Psikotes Tambahan' });
  assert.equal(custom.status, 201);
  const del = await api.delete(`/api/stages/${custom.body.data.id}`);
  assert.equal(del.status, 200);
});

test('stage can be renamed and deactivated', async () => {
  const custom = await api.post('/api/stages').send({ name: 'Temp Stage' });
  const id = custom.body.data.id;
  const res = await api.put(`/api/stages/${id}`).send({ name: 'Renamed Stage', is_active: false });
  assert.equal(res.status, 200);
  const after = (await api.get('/api/stages')).body.data.find((s) => s.id === id);
  assert.equal(after.name, 'Renamed Stage');
  assert.equal(after.is_active, 0);
});

test('reorder updates order_num', async () => {
  const stages = (await api.get('/api/stages')).body.data;
  const ids = stages.map((s) => s.id).reverse();
  const res = await api.post('/api/stages/reorder').send({ stageIds: ids });
  assert.equal(res.status, 200);
  const reordered = (await api.get('/api/stages')).body.data;
  assert.equal(reordered[0].id, ids[0]);
});

test('dashboard stats returns counts', async () => {
  const res = await api.get('/api/dashboard/stats');
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.stats.total, 'number');
  assert.ok('active' in res.body.stats);
});
