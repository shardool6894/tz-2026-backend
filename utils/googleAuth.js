const { OAuth2Client } = require('google-auth-library');

let client;
const getClient = () => {
  client = client || new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return client;
};

// Verifies a Google ID token (the `credential` from Google Identity Services).
// Throws if the token is forged, expired, or issued for a different app.
const verifyGoogleCredential = async (credential) => {
  const ticket = await getClient().verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new Error('Google account email is not verified');
  }
  return {
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
  };
};

module.exports = { verifyGoogleCredential };
