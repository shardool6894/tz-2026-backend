const express = require('express')
const router = express.Router();

const { register, login } = require('../controllers/authController')
const { googleVerify } = require('../controllers/googleAuthController')
const { requireGoogleRegistration } = require('../middleware/googleRegistration')
const limits = require('../middleware/rateLimits')

// NOTE: multer removed — the backend expects either JSON metadata, pre-uploaded URLs,
// or base64 image strings in the request body. Files should be uploaded to Cloudinary
// directly from the client or sent as base64 strings.
router.post('/google', limits.google, googleVerify)
router.post('/register', limits.register, requireGoogleRegistration, register)
router.post('/login', limits.loginIp, limits.loginAccount, login)

module.exports = router
