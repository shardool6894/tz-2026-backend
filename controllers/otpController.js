const { Resend } = require('resend');
const Otp = require('../models/Otp');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set in environment.');
      return res.status(500).json({ message: 'Email service is not configured.' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Upsert: replace any existing OTP for this email
    await Otp.findOneAndUpdate(
      { email },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Technozion <noreply@technozion.nitw.ac.in>';

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Technozion 2026 — Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0f1a; color: #ffffff; border-radius: 12px;">
          <h1 style="color: #16f6f3; font-size: 24px; margin-bottom: 8px;">Technozion 2026</h1>
          <p style="color: #aaaaaa; margin-bottom: 24px;">Email Verification</p>
          <p style="font-size: 15px; margin-bottom: 16px;">Your one-time verification code is:</p>
          <div style="background: #1a2535; border: 1px solid #16f6f3; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #16f6f3;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #888888;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border-color: #222;" />
          <p style="font-size: 12px; color: #555;">Technozion — NIT Warangal's Annual Techno-Management Fest</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    }

    return res.json({ message: 'OTP sent successfully. Check your inbox.' });
  } catch (err) {
    console.error('sendOtp error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const record = await Otp.findOne({ email });

    if (!record) {
      return res.status(400).json({ message: 'No OTP was sent to this email. Please request a new one.' });
    }

    if (new Date() > record.expiresAt) {
      await Otp.deleteOne({ email });
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    // OTP is valid — clear it
    await Otp.deleteOne({ email });
    return res.json({ message: 'Email verified successfully.', verified: true });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = { sendOtp, verifyOtp };
