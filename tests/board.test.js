const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

const signupAndCreateWorkspace = async (email = 'ayomide@test.com') => {
  const signup = await request(app).post('/api/auth/signup').send({
    name: 'Ayomide',
    email,
    password: 'password123',
  });
  const token = signup.body.token;

  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Workspace' });
  const workspaceId = workspaceRes.body.id;

  return { token, workspaceId };
};

const setupBoard = async () => {
  const { token, workspaceId } = await signupAndCreateWorkspace();

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Test Board', workspaceId });
  const boardId = boardRes.body.id;

  return { token, workspaceId, boardId };
};

describe('Board CRUD', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a board in a workspace', async () => {
    const { token, workspaceId } = await signupAndCreateWorkspace();

    const res = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sprint Planning', workspaceId });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Sprint Planning');
    expect(res.body.workspaceId).toBe(workspaceId);
  });

  it('rejects board creation without a title', async () => {
    const { token, workspaceId } = await signupAndCreateWorkspace();

    const res = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId });

    expect(res.status).toBe(400);
  });

  it('rejects board creation without auth', async () => {
    const { workspaceId } = await signupAndCreateWorkspace();

    const res = await request(app)
      .post('/api/boards')
      .send({ title: 'No auth board', workspaceId });

    expect(res.status).toBe(401);
  });

  it('gets a board by id with nested lists and cards', async () => {
    const { token, boardId } = await setupBoard();

    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'To Do', position: 1 });

    await request(app)
      .post(`/api/lists/${listRes.body.id}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.lists).toHaveLength(1);
    expect(res.body.lists[0].cards).toHaveLength(1);
    expect(res.body.lists[0].cards[0].title).toBe('Fix login bug');
  });

  it('returns 404 for a board that does not exist', async () => {
    const { token } = await setupBoard();

    const res = await request(app)
      .get('/api/boards/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejects access from a user who is not a workspace member', async () => {
    const { boardId } = await setupBoard();
    const { token: outsiderToken } = await signupAndCreateWorkspace('outsider@test.com');

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('creates a list on a board', async () => {
    const { token, boardId } = await setupBoard();

    const res = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'In Progress', position: 1 });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('In Progress');
    expect(res.body.boardId).toBe(boardId);
  });

  it('rejects list creation without a title', async () => {
    const { token, boardId } = await setupBoard();

    const res = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ position: 1 });

    expect(res.status).toBe(400);
  });

  it('updates a list title and position', async () => {
    const { token, boardId } = await setupBoard();

    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'To Do', position: 1 });

    const res = await request(app)
      .patch(`/api/lists/${listRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backlog', position: 2 });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Backlog');
    expect(res.body.position).toBe(2);
  });

  it('renames a board', async () => {
    const { token, boardId } = await setupBoard();

    const res = await request(app)
      .patch(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed Board' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Renamed Board');
  });

  it('rejects renaming a board without a title', async () => {
    const { token, boardId } = await setupBoard();

    const res = await request(app)
      .patch(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('deletes a board', async () => {
    const { token, boardId } = await setupBoard();

    const res = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });

  it('deletes a list', async () => {
    const { token, boardId } = await setupBoard();

    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'To Do', position: 1 });

    const res = await request(app)
      .delete(`/api/lists/${listRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const boardRes = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(boardRes.body.lists).toHaveLength(0);
  });

  it('returns board activity in most-recent-first order', async () => {
    const { token, boardId } = await setupBoard();

    const listRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'To Do', position: 1 });

    const firstCard = await request(app)
      .post(`/api/lists/${listRes.body.id}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'First card', position: 1 });

    await request(app)
      .patch(`/api/cards/${firstCard.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'First card (updated)' });

    const res = await request(app)
      .get(`/api/boards/${boardId}/activity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].action).toContain('updated card');
    expect(res.body[1].action).toContain('created card');
  });
});