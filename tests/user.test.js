const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

const signup = async (email = 'ayomide@test.com', name = 'Ayomide') => {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return res.body.token;
};

describe('User profile', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("updates the user's name", async () => {
    const token = await signup();

    const res = await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ayomide Kolawole' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Ayomide Kolawole');
  });

  it('persists the name change', async () => {
    const token = await signup();

    await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meRes.body.user.name).toBe('Updated Name');
  });

  it('rejects a profile update without a name', async () => {
    const token = await signup();

    const res = await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects a profile update without auth', async () => {
    const res = await request(app).patch('/api/user/profile').send({ name: 'Nobody' });
    expect(res.status).toBe(401);
  });
});

describe('Avatar upload', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('uploads an avatar and returns the new URL', async () => {
    const token = await signup();

    const res = await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('fake-image-bytes'), { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toMatch(/^https:\/\//);
  });

  it('persists the avatar URL', async () => {
    const token = await signup();

    await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('fake-image-bytes'), { filename: 'photo.png', contentType: 'image/png' });

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meRes.body.user.avatarUrl).toMatch(/^https:\/\//);
  });

  it('replaces an existing avatar when uploading a new one', async () => {
    const token = await signup();

    const firstRes = await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('first-image'), { filename: 'first.png', contentType: 'image/png' });

    const secondRes = await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('second-image'), { filename: 'second.png', contentType: 'image/png' });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.user.avatarUrl).not.toBe(firstRes.body.user.avatarUrl);
  });

  it('rejects a non-image file type', async () => {
    const token = await signup();

    const res = await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('just some text'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('rejects a file over the 5MB limit', async () => {
    const token = await signup();
    const oversized = Buffer.alloc(6 * 1024 * 1024);

    const res = await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', oversized, { filename: 'huge.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });

  it('rejects an upload with no file attached', async () => {
    const token = await signup();

    const res = await request(app).post('/api/user/avatar').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejects an upload without auth', async () => {
    const res = await request(app)
      .post('/api/user/avatar')
      .attach('avatar', Buffer.from('image'), { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });

  it('removes an avatar', async () => {
    const token = await signup();

    await request(app)
      .post('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('image'), { filename: 'photo.png', contentType: 'image/png' });

    const res = await request(app).delete('/api/user/avatar').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBeNull();
  });

  it('removing an avatar that was never set is still a clean success', async () => {
    const token = await signup();

    const res = await request(app).delete('/api/user/avatar').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBeNull();
  });
});