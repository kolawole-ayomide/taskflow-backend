const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase, prisma } = require('./setup');

const signup = async (email = 'ayomide@test.com', name = 'Ayomide') => {
  const res = await request(app).post('/api/auth/signup').send({
    name,
    email,
    password: 'password123',
  });
  return res.body.token;
};

describe('Email verification', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new user as unverified, with a verification token stored', async () => {
    await signup('ayomide@test.com');

    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });

    expect(user.emailVerified).toBe(false);
    expect(user.verificationToken).toBeTruthy();
  });

  it('verifies the email with a valid token', async () => {
    await signup('ayomide@test.com');
    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: user.verificationToken });

    expect(res.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });
    expect(updatedUser.emailVerified).toBe(true);
    expect(updatedUser.verificationToken).toBeNull();
  });

  it('rejects an invalid verification token', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'not-a-real-token' });

    expect(res.status).toBe(400);
  });

  it('rejects an expired verification token', async () => {
    await signup('ayomide@test.com');
    await prisma.user.update({
      where: { email: 'ayomide@test.com' },
      data: { verificationExpiresAt: new Date(Date.now() - 1000) },
    });
    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: user.verificationToken });

    expect(res.status).toBe(400);
  });

  it('resends a verification email with a fresh token', async () => {
    const token = await signup('ayomide@test.com');
    const originalUser = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });
    expect(updatedUser.verificationToken).not.toBe(originalUser.verificationToken);
  });

  it('rejects resending verification for an already-verified user', async () => {
    const token = await signup('ayomide@test.com');
    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });
    await request(app).post('/api/auth/verify-email').send({ token: user.verificationToken });

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Password reset', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('always returns 200 for forgot-password, whether or not the email exists', async () => {
    await signup('ayomide@test.com');

    const knownRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ayomide@test.com' });
    const unknownRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' });

    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
  });

  it('sets a reset token when the email exists', async () => {
    await signup('ayomide@test.com');

    await request(app).post('/api/auth/forgot-password').send({ email: 'ayomide@test.com' });

    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });
    expect(user.resetToken).toBeTruthy();
  });

  it('resets the password with a valid token and allows login with the new password', async () => {
    await signup('ayomide@test.com');
    await request(app).post('/api/auth/forgot-password').send({ email: 'ayomide@test.com' });
    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: user.resetToken, newPassword: 'newpassword456' });

    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ayomide@test.com', password: 'newpassword456' });

    expect(loginRes.status).toBe(200);

    const oldPasswordLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ayomide@test.com', password: 'password123' });

    expect(oldPasswordLoginRes.status).toBe(401);
  });

  it('rejects an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'whatever123' });

    expect(res.status).toBe(400);
  });

  it('rejects an expired reset token', async () => {
    await signup('ayomide@test.com');
    await request(app).post('/api/auth/forgot-password').send({ email: 'ayomide@test.com' });
    await prisma.user.update({
      where: { email: 'ayomide@test.com' },
      data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
    });
    const user = await prisma.user.findUnique({ where: { email: 'ayomide@test.com' } });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: user.resetToken, newPassword: 'whatever123' });

    expect(res.status).toBe(400);
  });
});