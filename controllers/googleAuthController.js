const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyGoogleCredential } = require('../utils/googleAuth');

const REGISTRATION_TOKEN_TTL = '2h';

// POST /api/auth/google  { credential }
// Verifies the Google sign-in and hands back the verified name/email plus a
// short-lived token that /api/auth/register requires.
const googleVerify = async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ message: 'Google credential is required' });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error('GOOGLE_CLIENT_ID is not set');
    return res.status(500).json({ message: 'Google sign-in is not configured on the server' });
  }

  let profile;
  try {
    profile = await verifyGoogleCredential(credential);
  } catch (err) {
    return res.status(401).json({ message: 'Google sign-in could not be verified. Please try again.' });
  }

  try {
    const existing = await User.findOne({ email: profile.email }).select('_id');
    if (existing) {
      return res.status(409).json({
        message: 'You can register only once for the fest.',
        alreadyRegistered: true,
      });
    }
    const registrationToken = jwt.sign(
      { purpose: 'tz-register', email: profile.email, name: profile.name },
      process.env.jwt_key,
      { expiresIn: REGISTRATION_TOKEN_TTL }
    );
    return res.json({ email: profile.email, name: profile.name, registrationToken });
  } catch (err) {
    console.error('Google verify error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

module.exports = { googleVerify };
