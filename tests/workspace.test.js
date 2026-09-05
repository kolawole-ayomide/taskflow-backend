const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

const signup = async (email = 'ayomide@test.com', name = 'Ayomide') => {
  const res = await request(app).post('/api/auth/signup').send({
    name,
    email,
    password: 'password123',
  });
  return res.body.token;
};

describe('Workspace CRUD', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a workspace with the creator as owner', async () => {
    const token = await signup();

    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Workspace' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Workspace');
  });

  it('rejects workspace creation without a name', async () => {
    const token = await signup();

    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('lists workspaces the user belongs to, with their role', async () => {
    const token = await signup();

    await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Workspace' });

    const res = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].role).toBe('OWNER');
  });

  it('renames a workspace', async () => {
    const token = await signup();

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name' });

    const res = await request(app)
      .patch(`/api/workspaces/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('rejects renaming a workspace without a name', async () => {
    const token = await signup();

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name' });

    const res = await request(app)
      .patch(`/api/workspaces/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects a non-member from renaming a workspace', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');
    const outsiderToken = await signup('outsider@test.com', 'Outsider');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    const res = await request(app)
      .patch(`/api/workspaces/${createRes.body.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('invites an existing user to a workspace', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');
    await signup('invitee@test.com', 'Invitee');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    const res = await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'invitee@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MEMBER');
  });

  it('creates a pending invite and emails a signup link for someone without an account', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    const res = await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'nobody-yet@test.com' });

    expect(res.status).toBe(202);
  });

  it('auto-joins the workspace when an invited email signs up later', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'late-joiner@test.com' });

    const newUserToken = await signup('late-joiner@test.com', 'Late Joiner');

    const workspacesRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${newUserToken}`);

    expect(workspacesRes.status).toBe(200);
    expect(workspacesRes.body).toHaveLength(1);
    expect(workspacesRes.body[0].id).toBe(createRes.body.id);
    expect(workspacesRes.body[0].role).toBe('MEMBER');
  });

  it('rejects inviting someone who is already a member', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');
    await signup('invitee@test.com', 'Invitee');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'invitee@test.com' });

    const res = await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'invitee@test.com' });

    expect(res.status).toBe(409);
  });

  it('rejects a MEMBER from inviting others', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');
    const memberToken = await signup('member@test.com', 'Member');
    const outsiderToken = await signup('outsider@test.com', 'Outsider');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@test.com' });

    const res = await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: 'outsider@test.com' });

    expect(res.status).toBe(403);
  });

  it('deletes a workspace as owner', async () => {
    const token = await signup();

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Doomed Workspace' });

    const res = await request(app)
      .delete(`/api/workspaces/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('rejects a MEMBER from deleting a workspace', async () => {
    const ownerToken = await signup('owner@test.com', 'Owner');
    const memberToken = await signup('member@test.com', 'Member');

    const createRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Workspace' });

    await request(app)
      .post(`/api/workspaces/${createRes.body.id}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@test.com' });

    const res = await request(app)
      .delete(`/api/workspaces/${createRes.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});