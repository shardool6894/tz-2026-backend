const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const MINUTE = 60 * 1000;
const tooMany = (message) => (req, res) => res.status(429).json({ message });
const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};
const clientIp = (req) => ipKeyGenerator(req.ip || '');
const bodyEmail = (req) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';

// NIT Warangal students often share one campus IP (NAT), so the per-IP limits below are
// deliberately generous: they stop scripted floods, not a hall full of real registrants.
// The strict limit is per account (login), where a real user never gets near it.
const createRateLimiters = (overrides = {}) => {
  const o = {
    googleMax: 100,          // Google sign-in checks per IP per 15 min
    registerMax: 60,         // registrations per IP per hour
    loginIpMax: 100,         // login attempts per IP per 15 min
    loginAccountMax: 8,      // FAILED logins per IP+email per 15 min
    userActionMax: 30,       // search / lookup / invite calls per logged-in user per minute
    ...overrides,
  };

  return {
    google: rateLimit({
      ...base,
      windowMs: 15 * MINUTE,
      limit: o.googleMax,
      keyGenerator: clientIp,
      handler: tooMany('Too many sign-in attempts. Please wait a few minutes and try again.'),
    }),
    register: rateLimit({
      ...base,
      windowMs: 60 * MINUTE,
      limit: o.registerMax,
      keyGenerator: clientIp,
      handler: tooMany('Too many registration attempts from this network. Please try again later.'),
    }),
    loginIp: rateLimit({
      ...base,
      windowMs: 15 * MINUTE,
      limit: o.loginIpMax,
      keyGenerator: clientIp,
      handler: tooMany('Too many login attempts. Please wait a few minutes and try again.'),
    }),
    // Only failed attempts count, so a correct login never uses up the budget.
    loginAccount: rateLimit({
      ...base,
      windowMs: 15 * MINUTE,
      limit: o.loginAccountMax,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `${clientIp(req)}|${bodyEmail(req)}`,
      handler: tooMany('Too many failed logins for this account. Please wait 15 minutes and try again.'),
    }),
    // Use AFTER `protect`, so req.user exists.
    userAction: rateLimit({
      ...base,
      windowMs: MINUTE,
      limit: o.userActionMax,
      keyGenerator: (req) => (req.user ? `user:${req.user._id}` : clientIp(req)),
      handler: tooMany('You are doing that too quickly. Please slow down.'),
    }),
  };
};

module.exports = { createRateLimiters, ...createRateLimiters() };
