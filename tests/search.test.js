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
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Fix login bug');
    expect(res.body.total).toBe(1);
    expect(res.body.hasMore).toBe(false);
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
    expect(res.body.items).toHaveLength(1);
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
    expect(res.body.items).toHaveLength(2);
    const boardNames = res.body.items.map((c) => c.boardName).sort();
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
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Assigned card');
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
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Urgent card');
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
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Due soon');
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
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Fix payment bug');
  });

  it('returns an empty result when nothing matches', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Fix login bug', position: 1 });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=nonexistentterm`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
    expect(res.body.hasMore).toBe(false);
  });

  it('rejects a non-member from searching a workspace', async () => {
    const { workspaceId } = await setupWorkspaceWithBoard();
    const outsider = await signup('outsider@test.com', 'Outsider');

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=anything`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });

  it('returns each card with its priority', async () => {
    const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

    const cardRes = await request(app)
      .post(`/api/lists/${listId}/cards`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Critical bug', position: 1, priority: 'CRITICAL' });

    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/search?q=critical`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.body.items[0].priority).toBe('CRITICAL');
  });

  describe('Pagination', () => {
    const createNCards = async (owner, listId, n) => {
      for (let i = 1; i <= n; i += 1) {
        await request(app)
          .post(`/api/lists/${listId}/cards`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ title: `Card ${i}`, position: i });
      }
    };

    it('defaults to a page size of 25 with an accurate total and hasMore', async () => {
      const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();
      await createNCards(owner, listId, 30);

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/search`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.body.items).toHaveLength(25);
      expect(res.body.total).toBe(30);
      expect(res.body.hasMore).toBe(true);
    });

    it('respects a custom limit and offset', async () => {
      const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();
      await createNCards(owner, listId, 10);

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/search?limit=4&offset=8`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(10);
      expect(res.body.hasMore).toBe(false);
    });

    it('caps limit at 100 even if a larger value is requested', async () => {
      const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();
      await createNCards(owner, listId, 5);

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/search?limit=500`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(5);
    });

    it('paginates correctly even when combined with a label filter', async () => {
      const { owner, workspaceId, listId } = await setupWorkspaceWithBoard();

      for (let i = 1; i <= 5; i += 1) {
        const cardRes = await request(app)
          .post(`/api/lists/${listId}/cards`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ title: `Urgent ${i}`, position: i });

        await request(app)
          .patch(`/api/cards/${cardRes.body.id}`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ labels: ['urgent'] });
      }

      // One extra card without the label, to prove it's correctly excluded
      // from both the page and the total even with pagination active.
      await request(app)
        .post(`/api/lists/${listId}/cards`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Not urgent', position: 6 });

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/search?label=urgent&limit=2&offset=0`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.hasMore).toBe(true);
    });
  });
});