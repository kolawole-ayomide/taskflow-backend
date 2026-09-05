const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_USER;

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  // Never make a real network call during tests — keeps the suite fast and deterministic,
  // no matter what ends up in .env.test.
  if (process.env.NODE_ENV === 'test') {
    return { skipped: true, reason: 'test environment' };
  }

  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn(`[email] SMTP not configured — skipping email to ${to} ("${subject}")`);
    return { skipped: true };
  }

  try {
    return await activeTransporter.sendMail({ from: EMAIL_FROM, to, subject, html });
  } catch (error) {
    // A failed email should never break the request that triggered it (signup, invite, etc.)
    console.error(`[email] Failed to send to ${to}:`, error.message);
    return { skipped: true, error: error.message };
  }
};

const sendVerificationEmail = ({ to, token }) => {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: 'Verify your TaskFlow email',
    html: `<p>Welcome to TaskFlow! Click below to verify your email:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  });
};

const sendPasswordResetEmail = ({ to, token }) => {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  return sendEmail({
    to,
    subject: 'Reset your TaskFlow password',
    html: `<p>Click below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  });
};

const sendWorkspaceInviteEmail = ({ to, workspaceName, token, existingUser }) => {
  const link = existingUser
    ? `${FRONTEND_URL}/workspaces`
    : `${FRONTEND_URL}/signup?inviteToken=${token}`;

  const html = existingUser
    ? `<p>You've been added to "${workspaceName}" on TaskFlow. <a href="${link}">Open it here.</a></p>`
    : `<p>You've been invited to join "${workspaceName}" on TaskFlow. <a href="${link}">Sign up to join.</a></p><p>This invite expires in 7 days.</p>`;

  return sendEmail({ to, subject: "You've been invited to a TaskFlow workspace", html });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendWorkspaceInviteEmail };