const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

const setupWorkspaceBoardListCard = async () => {
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

  const cardRes = await request(app)
    .post(`/api/lists/${listId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Fix login bug', position: 1 });
  const cardId = cardRes.body.id;

  return { token, workspaceId, boardId, listId, cardId };
};

describe('Comment CRUD', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a comment on a card', async () => {
    const { token, cardId } = await setupWorkspaceBoardListCard();

    const res = await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'This looks good to me' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('This looks good to me');
    expect(res.body.cardId).toBe(cardId);
  });

  it('rejects an empty comment', async () => {
    const { token, cardId } = await setupWorkspaceBoardListCard();

    const res = await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('lists comments for a card in order', async () => {
    const { token, cardId } = await setupWorkspaceBoardListCard();

    await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First comment' });

    await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Second comment' });

    const res = await request(app)
      .get(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('First comment');
    expect(res.body[1].content).toBe('Second comment');
  });

  it('deletes your own comment', async () => {
    const { token, cardId } = await setupWorkspaceBoardListCard();

    const commentRes = await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Delete me' });

    const res = await request(app)
      .delete(`/api/comments/${commentRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const listRes = await request(app)
      .get(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body).toHaveLength(0);
  });

  it("rejects deleting another user's comment", async () => {
    const { token, cardId } = await setupWorkspaceBoardListCard();

    const commentRes = await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Not yours' });

    const otherSignup = await request(app).post('/api/auth/signup').send({
      name: 'Someone Else',
      email: 'someone-else@test.com',
      password: 'password123',
    });
    const otherToken = otherSignup.body.token;

    const res = await request(app)
      .delete(`/api/comments/${commentRes.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when deleting a comment that does not exist', async () => {
    const { token } = await setupWorkspaceBoardListCard();

    const res = await request(app)
      .delete('/api/comments/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejects comment creation without auth', async () => {
    const { cardId } = await setupWorkspaceBoardListCard();

    const res = await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .send({ content: 'No auth comment' });

    expect(res.status).toBe(401);
  });
});