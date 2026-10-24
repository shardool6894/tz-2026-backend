const jwt = require('jsonwebtoken');

// Runs before the register controller. The email (and name) the user signed in
// with on Google replace whatever the request body claims, so the address can't
// be spoofed from the browser.
const requireGoogleRegistration = (req, res, next) => {
  const token = req.body?.registrationToken;
  if (typeof token !== 'string' || !token) {
    return res.status(401).json({
      message: 'Please sign in with Google before registering.',
      code: 'GOOGLE_AUTH_REQUIRED',
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.jwt_key);
    if (decoded.purpose !== 'tz-register' || !decoded.email) throw new Error('Wrong token type');
    req.body.email = decoded.email;
    if (decoded.name) req.body.name = decoded.name;
    delete req.body.registrationToken;
    return next();
  } catch (err) {
    return res.status(401).json({
      message: 'Your Google sign-in has expired. Please sign in with Google again.',
      code: 'GOOGLE_AUTH_REQUIRED',
    });
  }
};

module.exports = { requireGoogleRegistration };
