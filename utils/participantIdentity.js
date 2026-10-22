const { randomInt } = require('node:crypto');
const { isNitwEmail } = require('../middleware/registrationChecks');

const invalid = (message) => {
  const error = new Error(message);
  error.status = 400;
  throw error;
};

const assignIdentity = (studentType, rawRollNumber, label, usedIds) => {
  if (!['nitw', 'external'].includes(studentType)) {
    invalid(`${label}: select NITW student or other institution`);
  }
  if (studentType === 'nitw') {
    const rollNumber = typeof rawRollNumber === 'string' ? rawRollNumber.trim().toUpperCase() : '';
    if (!/^[A-Z0-9-]{3,32}$/.test(rollNumber)) {
      invalid(`${label}: a valid NITW roll number is required (3–32 letters, digits or hyphens)`);
    }
    return { studentType, rollNumber, participantId: rollNumber };
  }
  let participantId;
  do {
    participantId = `26TZ${randomInt(36 ** 4).toString(36).toUpperCase().padStart(4, '0')}`;
  } while (usedIds.has(participantId));
  usedIds.add(participantId);
  return { studentType, rollNumber: null, participantId };
};

const buildParticipantIdentities = ({ email, rollNumber, teamMembers = [] }) => {
  // Reserve institute rolls before generating outsider IDs, including mixed teams.
  const usedIds = new Set([
    ...(isNitwEmail(email) ? [rollNumber] : []),
    ...teamMembers.filter(member => member?.studentType === 'nitw').map(member => member.rollNumber),
  ].filter(value => typeof value === 'string').map(value => value.trim().toUpperCase()));
  const leader = assignIdentity(isNitwEmail(email) ? 'nitw' : 'external', rollNumber, 'Team lead', usedIds);
  const members = teamMembers.map((member, index) => {
    if (!member || typeof member.name !== 'string' || !member.name.trim()) {
      invalid(`Member ${index + 2}: name is required`);
    }
    return {
      name: member.name.trim(),
      ...assignIdentity(member.studentType, member.rollNumber, `Member ${index + 2}`, usedIds),
    };
  });
  const participantIds = [leader.participantId, ...members.map((member) => member.participantId)];
  if (new Set(participantIds).size !== participantIds.length) {
    invalid('Each NITW participant must have a different roll number');
  }
  return { ...leader, teamMembers: members, participantIds };
};

module.exports = { buildParticipantIdentities };
