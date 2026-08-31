// Must be set before helpers.js pulls in the app / fieldCrypto.
process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars -> raw key bytes

const { dbReady, login, authed } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const fieldCrypto = require('../utils/fieldCrypto');
const { query } = require('../db');

let api;

test.before(async () => {
  await dbReady();
  api = authed(await login());
});

test('fieldCrypto round-trips and leaves plaintext / null alone', () => {
  assert.equal(fieldCrypto.isEnabled(), true);
  const enc = fieldCrypto.encrypt('3201010101900001');
  assert.ok(enc.startsWith('enc:v1:'));
  assert.notEqual(enc, fieldCrypto.encrypt('3201010101900001'), 'IV makes ciphertext non-deterministic');
  assert.equal(fieldCrypto.decrypt(enc), '3201010101900001');
  assert.equal(fieldCrypto.decrypt('not-encrypted'), 'not-encrypted');
  assert.equal(fieldCrypto.decrypt(null), null);
});

test('blind index is deterministic and keyed', () => {
  assert.equal(fieldCrypto.blindIndex('123'), fieldCrypto.blindIndex(' 123 '));
  assert.notEqual(fieldCrypto.blindIndex('123'), fieldCrypto.blindIndex('124'));
  assert.equal(fieldCrypto.blindIndex(''), null);
});

test('NIK is stored encrypted but returned in the clear', async () => {
  const nik = '3273010101950009';
  const created = await api.post('/api/candidates').send({ name: 'Crypto One', nik });
  const id = created.body.candidateId;

  const raw = await query.get('SELECT nik, nik_bidx FROM candidates WHERE id = ?', [id]);
  assert.ok(raw.nik.startsWith('enc:v1:'), 'nik column holds ciphertext');
  assert.equal(raw.nik_bidx, fieldCrypto.blindIndex(nik), 'blind index is populated');

  const detail = await api.get(`/api/candidates/${id}`);
  assert.equal(detail.body.candidate.nik, nik, 'API decrypts on the way out');
  assert.equal('nik_bidx' in detail.body.candidate, false, 'blind index is not exposed');
});

test('other sensitive columns are encrypted too', async () => {
  const created = await api.post('/api/candidates').send({
    name: 'Crypto Two', npwp: '09.254.294.3-407.000', bank_account: '1234567890',
    health_history: 'asthma', allergies: 'penicillin',
  });
  const raw = await query.get('SELECT npwp, bank_account, health_history, allergies FROM candidates WHERE id = ?', [created.body.candidateId]);
  for (const v of Object.values(raw)) assert.ok(String(v).startsWith('enc:v1:'));

  const detail = await api.get(`/api/candidates/${created.body.candidateId}`);
  assert.equal(detail.body.candidate.npwp, '09.254.294.3-407.000');
  assert.equal(detail.body.candidate.health_history, 'asthma');
});

test('duplicate NIK is still rejected via the blind index', async () => {
  await api.post('/api/candidates').send({ name: 'Dup 1', nik: '1111222233334444' });
  const res = await api.post('/api/candidates').send({ name: 'Dup 2', nik: '1111222233334444' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /NIK/i);
});

test('exact NIK search finds the encrypted record', async () => {
  const nik = '9988776655443322';
  await api.post('/api/candidates').send({ name: 'Findable By Nik', nik });
  const res = await api.get(`/api/candidates?search=${nik}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].name, 'Findable By Nik');
  assert.equal(res.body.data[0].nik, nik);
});

test('manual employee NIK is encrypted and searchable', async () => {
  const nik = '5150005150005151';
  await api.post('/api/employees/manual').send({ name: 'Crypto Employee', nik });
  const res = await api.get(`/api/employees?search=${nik}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].nik, nik);
  assert.equal('nik_bidx' in res.body.data[0], false);
});
