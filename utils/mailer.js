const { Resend } = require('resend');

let resendClient;
const getResendClient = () => {
  if (resendClient) return resendClient;
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    throw new Error('Email is not configured: set RESEND_API_KEY');
  }
  resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Vercel freezes the function once the response is sent, so callers must `await` this.
const sendVerificationEmail = async ({ to, name, link }) => {
  // Resend requires a verified domain, so MAIL_FROM must be explicitly set
  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new Error('Sender email is not configured: set MAIL_FROM');
  }

  const safeName = escapeHtml(name || 'there');
  
  const { data, error } = await getResendClient().emails.send({
    from,
    to,
    subject: 'Verify your email for Technozion 2026',
    text: `Hi ${name || 'there'},\n\nPlease verify your email to finish setting up your Technozion 2026 account:\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this email.`,
    html: `<p>Hi ${safeName},</p><p>Please verify your email to finish setting up your Technozion 2026 account.</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
};

module.exports = { sendVerificationEmail };