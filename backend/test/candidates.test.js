const { dbReady, login, authed, request, app } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');

let api;

test.before(async () => {
  await dbReady();
  api = authed(await login());
});

test('create candidate returns an 8-char access code and seeds stage rows', async () => {
  const res = await api.post('/api/candidates').send({ name: 'Budi Santoso', nik: '3201010101900001' });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.match(res.body.accessCode, /^[A-Z0-9]{8}$/);

  const detail = await api.get(`/api/candidates/${res.body.candidateId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.candidate.name, 'Budi Santoso');
  assert.ok(detail.body.candidate.stage1, 'stage1_admin row should exist');
  assert.ok(detail.body.candidate.onboarding, 'onboarding row should exist');
});

test('create candidate requires a name', async () => {
  const res = await api.post('/api/candidates').send({ nik: '1' });
  assert.equal(res.status, 400);
});

test('duplicate NIK is rejected with a clear message', async () => {
  await api.post('/api/candidates').send({ name: 'First', nik: '9999999999999999' });
  const res = await api.post('/api/candidates').send({ name: 'Second', nik: '9999999999999999' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /NIK/i);
});

test('list supports search and status filters', async () => {
  await api.post('/api/candidates').send({ name: 'Searchable Zephyr' });
  const res = await api.get('/api/candidates?search=Zephyr');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((c) => /Zephyr/i.test(c.name)));
});

test('update candidate persists changes', async () => {
  const created = await api.post('/api/candidates').send({ name: 'Before Update' });
  const id = created.body.candidateId;
  const res = await api.put(`/api/candidates/${id}`).send({ name: 'After Update', phone: '08123456789' });
  assert.equal(res.status, 200);
  const detail = await api.get(`/api/candidates/${id}`);
  assert.equal(detail.body.candidate.name, 'After Update');
  assert.equal(detail.body.candidate.phone, '08123456789');
});

test('passing the admin stage advances the candidate to the next active stage', async () => {
  const created = await api.post('/api/candidates').send({ name: 'Progression Test' });
  const id = created.body.candidateId;

  const stages = (await api.get('/api/stages')).body.data.filter((s) => s.is_active);
  const adminStage = stages.find((s) => s.code === 'admin');
  const secondStage = stages[1];

  const res = await api.put(`/api/candidates/${id}/stage/${adminStage.id}`).send({
    berkas_lengkap: true, usia_sesuai: true, pendidikan_sesuai: true,
    skck_bersih: true, domisili_sesuai: true, passed: true,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.currentStage, secondStage.id);
});

test('rejecting a candidate at a stage sets status to Rejected', async () => {
  const created = await api.post('/api/candidates').send({ name: 'Reject Test' });
  const id = created.body.candidateId;
  const adminStage = (await api.get('/api/stages')).body.data.find((s) => s.code === 'admin');

  await api.put(`/api/candidates/${id}/stage/${adminStage.id}`).send({ passed: false, status: 'Rejected' });
  const detail = await api.get(`/api/candidates/${id}`);
  assert.equal(detail.body.candidate.status, 'Rejected');
});

test('delete candidate removes it', async () => {
  const created = await api.post('/api/candidates').send({ name: 'To Be Deleted' });
  const id = created.body.candidateId;
  const del = await api.delete(`/api/candidates/${id}`);
  assert.equal(del.status, 200);
  const detail = await api.get(`/api/candidates/${id}`);
  assert.equal(detail.status, 404);
});

test('written-test portal: validate, fetch questions, submit and score', async () => {
  const created = await api.post('/api/candidates').send({ name: 'Exam Taker' });
  const id = created.body.candidateId;
  const code = created.body.accessCode;

  // advance from admin (stage 1) to written (stage 2)
  const adminStage = (await api.get('/api/stages')).body.data.find((s) => s.code === 'admin');
  await api.put(`/api/candidates/${id}/stage/${adminStage.id}`).send({ passed: true });

  const validate = await request(app).get(`/api/test/validate/${code}`);
  assert.equal(validate.body.isValid, true);

  const questions = (await request(app).get(`/api/test/questions/${code}`)).body.questions;
  assert.ok(questions.length > 0);
  // no correct answers should ever be sent to the candidate
  assert.ok(questions.every((q) => !('correct_option' in q)));

  const submit = await request(app).post('/api/test/submit').send({ code, answers: {} });
  assert.equal(submit.status, 200);
  assert.equal(submit.body.results.passed, false);

  // a second submission is refused (already completed)
  const again = await request(app).get(`/api/test/validate/${code}`);
  assert.equal(again.body.isValid, false);
});

test('stage-6 candidates cannot use the written-test portal', async () => {
  const created = await api.post('/api/candidates').send({ name: 'Stage6 Person' });
  const id = created.body.candidateId;
  const code = created.body.accessCode;
  await api.put(`/api/candidates/${id}`).send({ name: 'Stage6 Person', current_stage: 6 });

  const validate = await request(app).get(`/api/test/validate/${code}`);
  assert.equal(validate.body.isValid, false);

  const submit = await request(app).post('/api/test/submit').send({ code, answers: {} });
  assert.equal(submit.status, 400);
});
