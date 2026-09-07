const request = require('supertest');
const app = require('../src/app');
const { cleanDatabase } = require('./setup');
const { checkDueDateReminders } = require('../src/jobs/dueDateReminders.job');

const signup = async (email, name) => {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return { token: res.body.token, userId: res.body.user.id };
};

const setupBoardWithTwoMembers = async () => {
  const owner = await signup('owner@test.com', 'Owner');
  const member = await signup('member@test.com', 'Member');

  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name: 'Test Workspace' });
  const workspaceId = workspaceRes.body.id;

  await request(app)
    .post(`/api/workspaces/${workspaceId}/invite`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ email: 'member@test.com' });

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

  const cardRes = await request(app)
    .post(`/api/lists/${listId}/cards`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ title: 'Fix login bug', position: 1 });
  const cardId = cardRes.body.id;

  return { owner, member, workspaceId, boardId, listId, cardId };
};

describe('Notifications', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('notifies a user when they are newly assigned to a card', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].verb).toBe('assigned_card');
    expect(res.body[0].unread).toBe(true);
  });

  it('does not notify the actor when they assign themselves', async () => {
    const { owner, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [owner.userId] });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('does not re-notify when the same assignee list is saved again', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.body).toHaveLength(1);
  });

  it('notifies a mentioned user in a comment', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    const res = await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Hey @Member can you check this?', mentionedUserIds: [member.userId] });

    expect(res.status).toBe(201);

    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);

    expect(notifRes.body).toHaveLength(1);
    expect(notifRes.body[0].verb).toBe('mentioned');
  });

  it('does not notify the author if they mention themselves', async () => {
    const { owner, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Note to self', mentionedUserIds: [owner.userId] });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.body).toHaveLength(0);
  });

  it('marks a single notification as read', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);
    const notificationId = listRes.body[0].id;

    const res = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].unread).toBe(false);
  });

  it('rejects marking a notification that belongs to someone else', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);
    const notificationId = listRes.body[0].id;

    const res = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(404);
  });

  it('marks all notifications as read', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId] });

    await request(app)
      .post(`/api/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Second heads up @Member', mentionedUserIds: [member.userId] });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${member.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((n) => n.unread === false)).toBe(true);
  });

  it('sends a due-soon reminder for a card due within 24 hours', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId], dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString() });

    await checkDueDateReminders();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);

    const dueSoon = res.body.filter((n) => n.verb === 'due_soon');
    expect(dueSoon).toHaveLength(1);
  });

  it('does not send a duplicate due-soon reminder on a second run', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId], dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString() });

    await checkDueDateReminders();
    await checkDueDateReminders();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);

    const dueSoon = res.body.filter((n) => n.verb === 'due_soon');
    expect(dueSoon).toHaveLength(1);
  });

  it('does not send a reminder for a card due more than 24 hours away', async () => {
    const { owner, member, cardId } = await setupBoardWithTwoMembers();

    await request(app)
      .patch(`/api/cards/${cardId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ assigneeIds: [member.userId], dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() });

    await checkDueDateReminders();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${member.token}`);

    const dueSoon = res.body.filter((n) => n.verb === 'due_soon');
    expect(dueSoon).toHaveLength(0);
  });
});