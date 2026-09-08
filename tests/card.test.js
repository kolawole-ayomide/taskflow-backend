const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

const setupWorkspaceBoardList = async () => {
  const signup = await request(app).post('/api/auth/signup').send({
    name: 'Ayomide',
    email: 'ayomide@test.com',
    password: 'password123',
  });
  const token = signup.body.token;

  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Workspace' });
  const workspaceId = workspaceRes.body.id;

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Test Board', workspaceId });
  const boardId = boardRes.body.id;

  const listRes = await request(app)
    .post(`/api/boards/${boardId}/lists`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'To Do', position: 1 });
  const listId = listRes.body.id;

  return { token, workspaceId, boardId, listId };
};

describe('Card CRUD', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a card in a list', async () => {
    const { token, listId } = await setupWorkspaceBoardList();

    const res = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Fix login bug');
  });

  it('updates a card title', async () => {
    const { token, listId } = await setupWorkspaceBoardList();

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const res = await request(app)
      .patch(`/api/cards/${cardRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug (updated)' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Fix login bug (updated)');
  });

  it('moves a card to a different list', async () => {
    const { token, boardId, listId } = await setupWorkspaceBoardList();

    const secondListRes = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Done', position: 2 });

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const res = await request(app)
      .patch(`/api/cards/${cardRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ listId: secondListRes.body.id, sourceListId: listId, position: 1 });

    expect(res.status).toBe(200);
    expect(res.body.listId).toBe(secondListRes.body.id);
  });

  it('deletes a card', async () => {
    const { token, listId } = await setupWorkspaceBoardList();

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const res = await request(app)
      .delete(`/api/cards/${cardRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

    it('rejects moving a card into a list from a different workspace', async () => {
    const { token, listId } = await setupWorkspaceBoardList();

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    // A completely separate workspace/board/list owned by a different user —
    // the first user has no membership here at all.
    const otherSignup = await request(app).post('/api/auth/signup').send({
      name: 'Someone Else',
      email: 'someone-else@test.com',
      password: 'password123',
    });
    const otherWorkspaceRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${otherSignup.body.token}`)
      .send({ name: 'Other Workspace' });
    const otherBoardRes = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${otherSignup.body.token}`)
      .send({ title: 'Other Board', workspaceId: otherWorkspaceRes.body.id });
    const otherListRes = await request(app)
      .post(`/api/boards/${otherBoardRes.body.id}/lists`)
      .set('Authorization', `Bearer ${otherSignup.body.token}`)
      .send({ title: 'Other List', position: 1 });

    const res = await request(app)
      .patch(`/api/cards/${cardRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ listId: otherListRes.body.id, sourceListId: listId, position: 1 });

    expect(res.status).toBe(400);
  });

  it('rejects assigning a card to someone outside the workspace', async () => {
    const { token, listId } = await setupWorkspaceBoardList();

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const outsiderSignup = await request(app).post('/api/auth/signup').send({
      name: 'Outsider',
      email: 'outsider@test.com',
      password: 'password123',
    });

    const res = await request(app)
      .patch(`/api/cards/${cardRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigneeIds: [outsiderSignup.body.user.id] });

    expect(res.status).toBe(400);
  });

  it('rejects card creation without auth', async () => {
    const { listId } = await setupWorkspaceBoardList();

    const res = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .send({ title: 'No auth card', position: 1 });

    expect(res.status).toBe(401);
  });
});