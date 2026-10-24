const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRateLimiters } = require('../middleware/rateLimits');

const serve = (build) => new Promise((resolve) => {
  const app = express();
  app.use(express.json());
  build(app);
  const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('failed logins for one account are limited, other accounts and good logins are not', async () => {
  const limits = createRateLimiters({ loginAccountMax: 3 });
  const { server, url } = await serve((app) =>
    app.post('/login', limits.loginAccount, (req, res) => res.status(req.body.password === 'right' ? 200 : 400).json({})));
  try {
    for (let i = 0; i < 3; i++) assert.equal((await post(`${url}/login`, { email: 'a@x.com', password: 'bad' })).status, 400);
    const blocked = await post(`${url}/login`, { email: 'A@x.com ', password: 'bad' });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).message, /Too many failed logins/);
    assert.equal((await post(`${url}/login`, { email: 'b@x.com', password: 'bad' })).status, 400);
  } finally { server.close(); }
});

test('successful logins do not use up the failed-login budget', async () => {
  const limits = createRateLimiters({ loginAccountMax: 2 });
  const { server, url } = await serve((app) =>
    app.post('/login', limits.loginAccount, (req, res) => res.status(req.body.password === 'right' ? 200 : 400).json({})));
  try {
    for (let i = 0; i < 6; i++) assert.equal((await post(`${url}/login`, { email: 'a@x.com', password: 'right' })).status, 200);
  } finally { server.close(); }
});

test('per-IP register limit returns a JSON 429', async () => {
  const limits = createRateLimiters({ registerMax: 2 });
  const { server, url } = await serve((app) => app.post('/register', limits.register, (req, res) => res.json({ ok: true })));
  try {
    assert.equal((await post(`${url}/register`, {})).status, 200);
    assert.equal((await post(`${url}/register`, {})).status, 200);
    const res = await post(`${url}/register`, {});
    assert.equal(res.status, 429);
    assert.ok((await res.json()).message);
  } finally { server.close(); }
});

test('user action limit is per logged-in user', async () => {
  const limits = createRateLimiters({ userActionMax: 2 });
  const { server, url } = await serve((app) => app.post('/act', (req, res, next) => { req.user = { _id: req.body.u }; next(); }, limits.userAction, (req, res) => res.json({})));
  try {
    assert.equal((await post(`${url}/act`, { u: '1' })).status, 200);
    assert.equal((await post(`${url}/act`, { u: '1' })).status, 200);
    assert.equal((await post(`${url}/act`, { u: '1' })).status, 429);
    assert.equal((await post(`${url}/act`, { u: '2' })).status, 200);
  } finally { server.close(); }
});
