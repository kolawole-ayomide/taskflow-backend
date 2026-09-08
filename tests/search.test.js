const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');

const signup = async (email, name) => {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return { token: res.body.token, userId: res.body.user.id };
};

const setupWorkspaceWithBoard = async () => {
  const owner = await signup('owner@test.com', 'Owner');

  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name: 'Test Workspace' });
  const workspaceId = workspaceRes.body.id;

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ title: 'Test Board', workspaceId });
  const boardId = boardRes.body.id;

  const listRes = await request(app)
    .post(`/api/boards/${boardId}/lists`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ title: 'To Do', position: 1 });
  const listId = listRes.body.id;

  return { owner, workspaceId, boardId, listId };
};

describe('Search & Filter', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('finds a card by matching title text', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Fix login bug', position: 1 });

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Update pricing page', position: 2 });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=login`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Fix login bug');
  });

  it('finds a card by matching description text', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Card One', position: 1 });

    await request(app)
      .patch(`/api/cards/${cardRes.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ description: 'Investigate the checkout timeout issue' });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=checkout`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('finds cards across multiple boards in the same workspace', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Renew SSL certificate', position: 1 });

    const secondBoardRes = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Second Board', workspaceId });

    const secondListRes = await request(app)
      .post(`/api/boards/${secondBoardRes.body.id}/lists`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Backlog', position: 1 });

    await request(app)
      .post(`/api/lists/${secondListRes.body.id}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Renew office lease', position: 1 });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=renew`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const boardNames = res.body.map((c) => c.boardName).sort();
    expect(boardNames).toEqual(['Second Board', 'Test Board']);
  });

  it('filters by assignee', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();
    const member = await signup('member@test.com', 'Member');

    await request(app)
      .post(`/api/workspaces/${workspaceId}/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'member@test.com' });

    const assignedCard = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Assigned card', position: 1 });

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Unassigned card', position: 2 });

    await request(app)
      .patch(`/api/cards/${assignedCard.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?assigneeId=${member.userId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Assigned card');
  });

  it('filters by label', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    const urgentCard = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Urgent card', position: 1 });

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Normal card', position: 2 });

    await request(app)
      .patch(`/api/cards/${urgentCard.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ labels: ['urgent', 'bug'] });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?label=urgent`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Urgent card');
  });

  it('filters by due date range', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    const soonCard = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Due soon', position: 1 });

    const laterCard = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Due later', position: 2 });

    await request(app)
      .patch(`/api/cards/${soonCard.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });

    await request(app)
      .patch(`/api/cards/${laterCard.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });

    const dueBefore = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?dueBefore=${dueBefore}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Due soon');
  });

  it('combines text search with an assignee filter', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();
    const member = await signup('member@test.com', 'Member');

    await request(app)
      .post(`/api/workspaces/${workspaceId}/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'member@test.com' });

    const match = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Fix payment bug', position: 1 });

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Fix another bug', position: 2 });

    await request(app)
      .patch(`/api/cards/${match.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=payment&assigneeId=${member.userId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Fix payment bug');
  });

  it('returns an empty array when nothing matches', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=nonexistentterm`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('rejects a non-member from searching a workspace', async () => {
    const { workspaceId } = await setupWorkspaceWithBoard();
    const outsider = await signup('outsider@test.com', 'Outsider');

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=anything`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });
});