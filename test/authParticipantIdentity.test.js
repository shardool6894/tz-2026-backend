const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildParticipantIdentities } = require('../utils/participantIdentity');
const { toPublicUser } = require('../utils/publicUser');
const { isNitwEmail } = require('../middleware/registrationChecks');

const loadController = (User) => {
  const module = { exports: {} };
  const mocks = {
    '../models/User': User,
    '../utils/participantIdentity': { buildParticipantIdentities },
    '../utils/publicUser': { toPublicUser },
    'bcryptjs': { hash: async () => 'hashed', compare: async () => true },
    'jsonwebtoken': { sign: () => 'test-token' },
    'mongoose': { Types: { ObjectId: { isValid: () => true } } },
    '../models/Event': {},
    '../utils/mailer': { sendVerificationEmail: async () => {} },
    '../utils/emailVerification': { newVerificationToken: () => ({ hash: 'test-hash', token: 'test-token' }), buildVerifyLink: () => 'test-link' },
    '../middleware/registrationChecks': { isNitwEmail, validateUploads: () => null },
    './otpController': {},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/authController'), 'utf8'), {
    module, exports: module.exports, require: (name) => {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    }, console: { error() {} }, process: { env: { jwt_key: 'test-key' } },
  });
  return module.exports;
};

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const body = {
  name: 'Test Lead', email: 'test@nitw.ac.in', password: 'test-password', rollNumber: '00123456',
  registrationType: 'team', teamMembers: [
    { name: 'NITW Member', studentType: 'nitw', rollNumber: '00123457' },
    { name: 'External Member', studentType: 'external', participantId: 'untrusted-id' },
  ],
};

test('registration stores and returns IDs for the lead and all members', async () => {
  let saved;
  const controller = loadController({ findOne: async () => null, create: async (payload) => { saved = payload; return payload; } });
  const res = response();
  await controller.register({ body }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(saved.participantId, '00123456');
  assert.equal(saved.teamMembers[0].rollNumber, '00123457');
  assert.match(saved.teamMembers[1].participantId, /^26TZ[A-Z0-9]{4}$/);
  assert.equal(res.body.participants.length, 3);
  assert.equal(res.body.participants[2].participantId, saved.teamMembers[1].participantId);
});

test('registration rejects missing roll numbers before saving', async () => {
  let saved = false;
  const controller = loadController({ findOne: async () => null, create: async () => { saved = true; } });
  const res = response();
  await controller.register({ body: { ...body, rollNumber: '' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(saved, false);
});

test('database duplicate participant IDs return a conflict instead of overwriting a user', async () => {
  const controller = loadController({ findOne: async () => null, create: async () => {
    throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { participantIds: 1 } });
  } });
  const res = response();
  await controller.register({ body }, res);
  assert.equal(res.statusCode, 409);
});

test('login returns stored IDs unchanged', async () => {
  const stored = { ...body, ...buildParticipantIdentities(body), emailVerified: true, registrationNum: '042' };
  const controller = loadController({ findOne: async () => stored });
  const res = response();
  await controller.login({ body: { email: body.email, password: body.password } }, res);
  assert.equal(res.body.user.participantId, '00123456');
  assert.equal(res.body.user.teamMembers[1].participantId, stored.teamMembers[1].participantId);
  assert.equal(res.body.user.registrationNum, '042');
});

test('a generated outsider ID collision retries the save and preserves NITW identities', async () => {
  let attempts = 0;
  const controller = loadController({ findOne: async () => null, create: async payload => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error('duplicate'), {
      code: 11000, keyPattern: { participantIds: 1 }, keyValue: { participantIds: payload.teamMembers[1].participantId },
    });
    assert.equal(payload.participantId, '00123456');
    assert.equal(payload.teamMembers[0].participantId, '00123457');
    assert.match(payload.teamMembers[1].participantId, /^26TZ[A-Z0-9]{4}$/);
    return payload;
  } });
  const res = response();
  await controller.register({ body }, res);
  assert.equal(attempts, 2);
  assert.equal(res.statusCode, 201);
});

test('NITW roll collisions do not retry or regenerate identities', async () => {
  let attempts = 0;
  const controller = loadController({ findOne: async () => null, create: async () => {
    attempts++;
    throw Object.assign(new Error('duplicate'), {
      code: 11000, keyPattern: { participantIds: 1 }, keyValue: { participantIds: '00123457' },
    });
  } });
  const res = response();
  await controller.register({ body }, res);
  assert.equal(attempts, 1);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /roll number/);
});

test('repeated outsider collisions stop after five attempts', async () => {
  let attempts = 0;
  const controller = loadController({ findOne: async () => null, create: async payload => {
    attempts++;
    throw Object.assign(new Error('duplicate'), {
      code: 11000, keyPattern: { participantIds: 1 }, keyValue: { participantIds: payload.teamMembers[1].participantId },
    });
  } });
  const res = response();
  await controller.register({ body }, res);
  assert.equal(attempts, 5);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /unique participant ID/);
});
