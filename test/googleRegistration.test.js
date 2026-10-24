const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.jwt_key = 'test-key-test-key-test-key';
const { requireGoogleRegistration } = require('../middleware/googleRegistration');

const response = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const run = (body) => {
  const req = { body };
  const res = response();
  let called = false;
  requireGoogleRegistration(req, res, () => { called = true; });
  return { req, res, called };
};

test('rejects registration without a Google token', () => {
  const { res, called } = run({ email: 'a@b.com' });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'GOOGLE_AUTH_REQUIRED');
});

test('rejects a login-style token or a forged token', () => {
  const loginToken = jwt.sign({ id: 'abc' }, process.env.jwt_key);
  assert.equal(run({ registrationToken: loginToken }).called, false);
  const forged = jwt.sign({ purpose: 'tz-register', email: 'x@y.com' }, 'other-key');
  assert.equal(run({ registrationToken: forged }).called, false);
});

test('verified email and name override whatever the body claims', () => {
  const token = jwt.sign({ purpose: 'tz-register', email: 'real@nitw.ac.in', name: 'Real Name' }, process.env.jwt_key);
  const { req, called } = run({ registrationToken: token, email: 'fake@nitw.ac.in', name: 'Fake' });
  assert.equal(called, true);
  assert.equal(req.body.email, 'real@nitw.ac.in');
  assert.equal(req.body.name, 'Real Name');
  assert.equal(req.body.registrationToken, undefined);
});
