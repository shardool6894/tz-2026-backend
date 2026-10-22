const test = require('node:test');
const assert = require('node:assert/strict');
const { buildParticipantIdentities } = require('../utils/participantIdentity');
const { toPublicUser } = require('../utils/publicUser');
const User = require('../models/User');

test('NITW lead keeps the roll number as a string and uses it as the ID', () => {
  const identities = buildParticipantIdentities({ email: 'student@student.nitw.ac.in', rollNumber: ' 00123456 ' });
  assert.equal(identities.rollNumber, '00123456');
  assert.equal(identities.participantId, '00123456');
  assert.deepEqual(identities.participantIds, ['00123456']);
});

test('every member of a mixed team gets their own server-assigned identity', () => {
  const identities = buildParticipantIdentities({
    email: 'outside@example.com', participantId: 'spoofed',
    teamMembers: [
      { name: ' NITW Student ', studentType: 'nitw', rollNumber: ' 25abc123 ', participantId: 'spoofed' },
      { name: 'External Student', studentType: 'external', participantId: 'spoofed', rollNumber: 'ignore-me' },
    ],
  });
  assert.match(identities.participantId, /^26TZ[A-Z0-9]{4}$/);
  assert.equal(identities.rollNumber, null);
  assert.equal(identities.teamMembers[0].participantId, '25ABC123');
  assert.equal(identities.teamMembers[0].name, 'NITW Student');
  assert.match(identities.teamMembers[1].participantId, /^26TZ[A-Z0-9]{4}$/);
  assert.equal(identities.teamMembers[1].rollNumber, null);
  assert.equal(new Set(identities.participantIds).size, 3);
});

test('missing or invalid NITW rolls are rejected', () => {
  for (const rollNumber of [undefined, '', 'a b', 123456]) {
    assert.throws(() => buildParticipantIdentities({ email: 'student@nitw.ac.in', rollNumber }), { status: 400 });
  }
});

test('duplicate rolls within a team and unknown member classifications are rejected', () => {
  assert.throws(() => buildParticipantIdentities({
    email: 'student@nitw.ac.in', rollNumber: '00123456',
    teamMembers: [{ name: 'Duplicate', studentType: 'nitw', rollNumber: '00123456' }],
  }), /different roll number/);
  assert.throws(() => buildParticipantIdentities({
    email: 'outside@example.com', teamMembers: [{ name: 'Missing type' }],
  }), { status: 400 });
});

test('generated outsider IDs are eight uppercase alphanumeric characters', () => {
  const ids = Array.from({ length: 100 }, () => buildParticipantIdentities({ email: 'outside@example.com' }).participantId);
  for (const id of ids) assert.match(id, /^26TZ[A-Z0-9]{4}$/);
});

test('Mongoose stores all participant fields and declares a cross-roster unique index', () => {
  const identities = buildParticipantIdentities({ email: 'outside@example.com', teamMembers: [{ name: 'Member', studentType: 'external' }] });
  const user = new User({ name: 'Lead', email: 'outside@example.com', registrationType: 'team', ...identities });
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.teamMembers[0].participantId, identities.teamMembers[0].participantId);
  assert.deepEqual([...user.participantIds], identities.participantIds);
  assert.ok(User.schema.indexes().some(([fields, options]) => fields.participantIds === 1 && options.unique && options.sparse));
  const publicUser = toPublicUser(user);
  assert.equal(publicUser.participantId, identities.participantId);
  assert.equal(publicUser.teamMembers[0].participantId, identities.teamMembers[0].participantId);
  assert.equal(publicUser.participantIds, undefined);
});

test('existing accounts remain readable without a participant-ID backfill', () => {
  const user = new User({ name: 'Existing', registrationNum: '042' });
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.participantIds, undefined);
  assert.equal(toPublicUser(user).registrationNum, '042');
});
