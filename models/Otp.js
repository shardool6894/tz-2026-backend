const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // MongoDB TTL index: automatically deletes the document after expiresAt
    index: { expires: 0 },
  },
});

module.exports = mongoose.model('Otp', otpSchema);
