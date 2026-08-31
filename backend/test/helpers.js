// Shared test bootstrap. Require this FIRST in every test file (before anything
// that pulls in ../db), so the SQLite database lands in a throwaway directory.
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-0123456789abcdef';
if (!process.env.DATA_DIR || !process.env.DATA_DIR.includes('hrm-test-')) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hrm-test-'));
}

const request = require('supertest');
const app = require('../app');

/** Resolve once the schema has been created and seeded. */
function dbReady() {
  return app.locals.dbReady;
}

/** Log in and return a bearer token (defaults to the seeded admin). */
async function login(username = 'admin', password = 'admin123') {
  const res = await request(app).post('/api/login').send({ username, password });
  if (!res.body.token) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

/** supertest agent-style helper that attaches the Authorization header. */
function authed(token) {
  const r = request(app);
  return {
    get: (url) => r.get(url).set('Authorization', `Bearer ${token}`),
    post: (url) => r.post(url).set('Authorization', `Bearer ${token}`),
    put: (url) => r.put(url).set('Authorization', `Bearer ${token}`),
    delete: (url) => r.delete(url).set('Authorization', `Bearer ${token}`),
  };
}

module.exports = { app, request, dbReady, login, authed };
