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
  assert.match(saved.teamMembers[1].participantId, /^26TZ[A-F0-9]{16}$/);
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
