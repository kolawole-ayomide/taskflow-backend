const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

describe('Auth', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('signs up a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Ayomide',
      email: 'ayomide@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('ayomide@test.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects signup with a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Ayomide',
      email: 'ayomide@test.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/signup').send({
      name: 'Someone Else',
      email: 'ayomide@test.com',
      password: 'password456',
    });

    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Ayomide',
      email: 'ayomide@test.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'ayomide@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Ayomide',
      email: 'ayomide@test.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'ayomide@test.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});