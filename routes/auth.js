const express = require('express')
const router = express.Router();

const {register,login,verifyEmail,resendVerification } = require('../controllers/authController')
const { sendOtp, verifyOtp } = require('../controllers/otpController')

// NOTE: multer removed — the backend expects either JSON metadata, pre-uploaded URLs,
// or base64 image strings in the request body. Files should be uploaded to Cloudinary
// directly from the client or sent as base64 strings.
router.post('/register', register)
router.post('/login', login)

// OTP-based email verification
router.post('/send-otp', sendOtp)
router.post('/verify-otp', verifyOtp)

router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
module.exports = router
