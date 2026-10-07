const test = require('node:test');
const assert = require('node:assert/strict');
const { createCorsOptions } = require('../utils/corsOptions');

const accepts = (env, origin) => {
  let accepted = false;
  createCorsOptions(env).origin(origin, (error, allowed) => { accepted = !error && allowed; });
  return accepted;
};
const config = { CORS_ORIGINS: 'http://localhost:3000, https://technozion-g1.vercel.app/' };

test('local development allows localhost and loopback across frontend ports', () => {
  for (const origin of ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:4317', 'http://[::1]:3000']) {
    assert.equal(accepts(config, origin), true, origin);
  }
});

test('production and Vercel keep the configured allowlist', () => {
  for (const mode of [{ NODE_ENV: 'production' }, { VERCEL: '1' }]) {
    const env = { ...config, ...mode };
    assert.equal(accepts(env, 'https://technozion-g1.vercel.app'), true);
    assert.equal(accepts(env, 'http://localhost:3000'), true);
    assert.equal(accepts(env, 'http://127.0.0.1:3000'), false);
    assert.equal(accepts(env, 'http://localhost:3001'), false);
  }
});

test('loopback exceptions reject lookalike and unrelated hosts', () => {
  for (const origin of ['http://localhost.example.com:3000', 'http://127.0.0.1.example.com', 'https://example.com', 'null']) {
    assert.equal(accepts(config, origin), false, origin);
  }
});

test('requests without an origin and the existing empty-allowlist behavior remain supported', () => {
  assert.equal(accepts(config, undefined), true);
  assert.equal(accepts({}, 'https://example.com'), true);
});
