const { app, dbReady, login, authed } = require('./helpers');
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

    // Idempotent retry
    const res2 = await client.post('/api/mobile/sync/employee').send(empPayload);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.server_id, res1.body.data.server_id);
  });

  it('GET /api/mobile/assets and /api/mobile/employees should return filtered results', async () => {
    const assetsRes = await client.get('/api/mobile/assets?search=Mobile Test Printer');
    assert.equal(assetsRes.status, 200);
    assert.ok(assetsRes.body.data.length > 0);

    const empRes = await client.get('/api/mobile/employees?search=Staf Lapangan Baru');
    assert.equal(empRes.status, 200);
    assert.ok(empRes.body.data.length > 0);
  });
});
