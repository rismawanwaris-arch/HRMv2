const test = require('node:test');
const assert = require('node:assert/strict');
const { app, dbReady, login, authed } = require('./helpers');

test('asset management lifecycle: add, list, replace, mutate, service, stats', async () => {
  await dbReady();
  const token = await login();
  const api = authed(token);

  // 1. Create test branches
  const branch1Res = await api.post('/api/branches').send({
    code: 'AST-B1',
    name: 'Konter Aset 1',
    city: 'Cirebon'
  });
  assert.equal(branch1Res.status, 200);
  const branch1Id = branch1Res.body.data.id;

  const branch2Res = await api.post('/api/branches').send({
    code: 'AST-B2',
    name: 'Konter Aset 2',
    city: 'Kuningan'
  });
  assert.equal(branch2Res.status, 200);
  const branch2Id = branch2Res.body.data.id;

  // 2. Add asset (Penambahan Aset Baru)
  const addRes = await api.post('/api/assets').send({
    name: 'HP Kasir Redmi 10',
    category: 'Elektronik & HP',
    branch_id: branch1Id,
    purchase_date: '2026-10-21',
    purchase_cost: 1800000,
    condition: 'Baik',
    brand: 'Xiaomi',
    serial_number: 'IMEI1234567890'
  });
  assert.equal(addRes.status, 201);
  assert.equal(addRes.body.success, true);
  const oldAssetId = addRes.body.id;

  // 3. List assets with branch filter
  const listRes = await api.get(`/api/assets?branch_id=${branch1Id}`);
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.length >= 1);
  assert.equal(listRes.body.data[0].name, 'HP Kasir Redmi 10');

  // 4. Replace asset (Penggantian Aset Rusak)
  const replaceRes = await api.post(`/api/assets/${oldAssetId}/replace`).send({
    replacement_asset_name: 'HP Kasir Vivo Y16 (Baru)',
    replacement_brand: 'Vivo',
    replacement_serial_number: 'IMEI987654321',
    replacement_cost: 1600000,
    reason: 'Layar HP lama pecah mati total',
    performed_by: 'Wisnu (GA)',
    register_as_new_asset: true
  });
  assert.equal(replaceRes.status, 200);
  assert.equal(replaceRes.body.success, true);
  const newAssetId = replaceRes.body.new_asset_id;
  assert.ok(newAssetId);

  // Verify old asset is now 'Diganti'
  const oldDetail = await api.get(`/api/assets/${oldAssetId}`);
  assert.equal(oldDetail.body.data.status, 'Diganti');
  assert.ok(oldDetail.body.data.logs.some(l => l.log_type === 'Penggantian'));

  // Verify new asset is 'Aktif'
  const newDetail = await api.get(`/api/assets/${newAssetId}`);
  assert.equal(newDetail.body.data.name, 'HP Kasir Vivo Y16 (Baru)');
  assert.equal(newDetail.body.data.status, 'Aktif');

  // 5. Mutate asset (Mutasi ke Cabang Lain)
  const mutateRes = await api.post(`/api/assets/${newAssetId}/mutate`).send({
    to_branch_id: branch2Id,
    reason: 'Pindah ke cabang baru'
  });
  assert.equal(mutateRes.status, 200);
  assert.equal(mutateRes.body.success, true);

  const mutatedDetail = await api.get(`/api/assets/${newAssetId}`);
  assert.equal(mutatedDetail.body.data.branch_id, branch2Id);

  // 6. Service asset (Servis/Perbaikan)
  const serviceRes = await api.post(`/api/assets/${newAssetId}/service`).send({
    cost: 150000,
    reason: 'Ganti anti gores dan ganti charger',
    new_condition: 'Baik'
  });
  assert.equal(serviceRes.status, 200);

  // 7. Get stats
  const statsRes = await api.get('/api/assets/stats');
  assert.equal(statsRes.status, 200);
  assert.ok(statsRes.body.data.totalActive >= 1);
  assert.ok(statsRes.body.data.totalReplaced >= 1);

  // 8. Get logs
  const logsRes = await api.get('/api/assets/logs/all');
  assert.equal(logsRes.status, 200);
  assert.ok(logsRes.body.data.length >= 3);
});
