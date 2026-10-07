const crypto = require('crypto');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // links work for 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000;     // one new email per minute per account

// Only the hash is stored, so a database leak doesn't expose usable links.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const newVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token), expires: new Date(Date.now() + TOKEN_TTL_MS) };
};

const buildVerifyLink = (token) => {
  const base = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('FRONTEND_URL is not set');
  return `${base}/verify-email?token=${token}`;
};

module.exports = { TOKEN_TTL_MS, RESEND_COOLDOWN_MS, hashToken, newVerificationToken, buildVerifyLink };