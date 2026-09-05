const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./email.service');

const registerUser = async ({ name, email, password }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('Email is already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, verificationToken, verificationExpiresAt },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  // Anyone invited to a workspace before they had an account gets attached automatically now
  const pendingInvites = await prisma.workspaceInvite.findMany({ where: { email } });
  if (pendingInvites.length > 0) {
    await prisma.$transaction([
      ...pendingInvites.map((invite) =>
        prisma.workspaceMember.create({
          data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
        })
      ),
      prisma.workspaceInvite.deleteMany({ where: { email } }),
    ]);
  }

  const token = generateToken({ userId: user.id });
  await sendVerificationEmail({ to: user.email, token: verificationToken });

  return { user, token };
};

const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  const token = generateToken({ userId: user.id });
  const safeUser = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };

  return { user: safeUser, token };
};

const requestPasswordReset = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately silent if no user exists — don't let this endpoint reveal which emails are registered
  if (!user) return;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiresAt },
  });

  await sendPasswordResetEmail({ to: user.email, token: resetToken });
};

const resetPassword = async ({ token, newPassword }) => {
  const user = await prisma.user.findFirst({ where: { resetToken: token } });

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    const error = new Error('Invalid or expired reset token');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });
};

const verifyEmail = async ({ token }) => {
  const user = await prisma.user.findFirst({ where: { verificationToken: token } });

  if (!user || !user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
    const error = new Error('Invalid or expired verification token');
    error.statusCode = 400;
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationExpiresAt: null },
  });
};

const resendVerification = async ({ userId }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.emailVerified) {
    const error = new Error('Email is already verified');
    error.statusCode = 400;
    throw error;
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { verificationToken, verificationExpiresAt },
  });

  await sendVerificationEmail({ to: user.email, token: verificationToken });
};

module.exports = { registerUser, loginUser, requestPasswordReset, resetPassword, verifyEmail, resendVerification };