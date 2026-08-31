const { dbReady, login, authed } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

let api;

test.before(async () => {
  await dbReady();
  api = authed(await login());
});

test('manual employee is created as Hired with an offering row', async () => {
  const res = await api.post('/api/employees/manual').send({
    name: 'Karyawan Lama',
    nik: '3273010101800001',
    phone: '081200000001',
    branch_id: null,
    contract_type: 'PKWTT',
    salary_offered: 4500000,
    allowance: 500000,
    hire_date: '2023-01-15',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const list = await api.get('/api/employees?search=Karyawan Lama');
  assert.equal(list.status, 200);
  const emp = list.body.data.find((e) => e.id === res.body.candidateId);
  assert.ok(emp, 'employee shows up in the Hired list');
  assert.equal(emp.status, 'Hired');
  assert.equal(emp.contract_type, 'PKWTT');
  assert.equal(emp.salary_offered, 4500000);
});

test('manual employee requires a name', async () => {
  const res = await api.post('/api/employees/manual').send({ nik: '123' });
  assert.equal(res.status, 400);
});

test('manual employee rejects a duplicate NIK', async () => {
  await api.post('/api/employees/manual').send({ name: 'Dup A', nik: '5555555555555555' });
  const res = await api.post('/api/employees/manual').send({ name: 'Dup B', nik: '5555555555555555' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /NIK/i);
});

test('update employee persists profile and contract changes', async () => {
  const created = await api.post('/api/employees/manual').send({ name: 'Edit Me', contract_type: 'PKWT' });
  const id = created.body.candidateId;

  const upd = await api.put(`/api/employees/${id}`).send({
    name: 'Edited Name',
    phone: '081299998888',
    contract_type: 'PKWTT',
    salary_offered: 6000000,
  });
  assert.equal(upd.status, 200);

  const emp = (await api.get('/api/employees?search=Edited Name')).body.data.find((e) => e.id === id);
  assert.equal(emp.name, 'Edited Name');
  assert.equal(emp.phone, '081299998888');
  assert.equal(emp.contract_type, 'PKWTT');
  assert.equal(emp.salary_offered, 6000000);
});

test('update employee 404s for an unknown id', async () => {
  const res = await api.put('/api/employees/9999999').send({ name: 'Nobody' });
  assert.equal(res.status, 404);
});

test('employee list can filter by contract type', async () => {
  await api.post('/api/employees/manual').send({ name: 'PKWT Only', contract_type: 'PKWT' });
  const res = await api.get('/api/employees?contract_type=PKWT');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((e) => e.contract_type === 'PKWT'));
});
