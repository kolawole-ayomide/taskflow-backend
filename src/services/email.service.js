const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM;

// Uses Brevo's HTTP API instead of SMTP — most free hosting platforms (Render's
// free tier included) block outbound SMTP ports, but regular HTTPS traffic like
// this is unaffected.
const sendEmail = async ({ to, subject, html }) => {
  // Never make a real network call during tests — keeps the suite fast and deterministic,
  // no matter what ends up in .env.test.
  if (process.env.NODE_ENV === 'test') {
    return { skipped: true, reason: 'test environment' };
  }

  if (!process.env.BREVO_API_KEY || !EMAIL_FROM) {
    console.warn(`[email] Brevo not configured — skipping email to ${to} ("${subject}")`);
    return { skipped: true };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: EMAIL_FROM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[email] Brevo failed to send to ${to}: ${response.status} ${errorBody}`);
      return { skipped: true, error: errorBody };
    }

    return await response.json();
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