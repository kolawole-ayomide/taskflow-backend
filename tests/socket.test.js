const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const { initSocket } = require('../src/sockets/socket.manager');
const { cleanDatabase } = require('./setup');

jest.setTimeout(10000);

let server;
let baseUrl;

beforeAll((done) => {
  server = http.createServer(app);
  initSocket(server);
  server.listen(() => {
    baseUrl = `http://localhost:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

const signup = async (email, name = 'Socket Test') => {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'password123' });
  return { token: res.body.token, userId: res.body.user.id };
};

const connectClient = (token) =>
  ioClient(baseUrl, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });

// Creates a real workspace + board, owned by whoever's token is passed in —
// the membership check now requires an actual board to validate against,
// not just any string.
const createBoardFor = async (token) => {
  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Socket Test Workspace' });

  const boardRes = await request(app)
    .post('/api/boards')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Socket Test Board', workspaceId: workspaceRes.body.id });

  return { workspaceId: workspaceRes.body.id, boardId: boardRes.body.id };
};

const inviteToWorkspace = async (ownerToken, workspaceId, email) => {
  await request(app)
    .post(`/api/workspaces/${workspaceId}/invite`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email });
};

describe('Socket.io connection and board presence', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('rejects a connection with no token', (done) => {
    const client = connectClient(null);
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/token/i);
      client.close();
      done();
    });
  });

  it('rejects a connection with an invalid token', (done) => {
    const client = ioClient(baseUrl, {
      auth: { token: 'not-a-real-token' },
      transports: ['websocket'],
      forceNew: true,
    });
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/invalid|expired/i);
      client.close();
      done();
    });
  });

  it('accepts a connection with a valid token', (done) => {
    signup('socket-user@test.com').then(({ token }) => {
      const client = connectClient(token);
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.close();
        done();
      });
      client.on('connect_error', done);
    });
  });

  it('rejects joining a board the user is not a member of', (done) => {
    Promise.all([signup('board-owner@test.com', 'Board Owner'), signup('stranger@test.com', 'Stranger')]).then(
      async ([owner, stranger]) => {
        const { boardId } = await createBoardFor(owner.token);

        const client = connectClient(stranger.token);

        client.on('connect', () => {
          client.emit('board:join', { boardId });
        });

        client.on('board:join_error', (payload) => {
          expect(payload.message).toBeDefined();
          client.close();
          done();
        });

        client.on('presence:sync', () => {
          client.close();
          done(new Error('Stranger should not have been allowed to join this board'));
        });

        client.on('connect_error', done);
      }
    );
  });

  it('broadcasts presence when a real member joins a board', (done) => {
    signup('presence-user@test.com', 'Presence User').then(async ({ token }) => {
      const { boardId } = await createBoardFor(token);
      const client = connectClient(token);

      client.on('connect', () => {
        client.emit('board:join', { boardId });
      });

      client.on('presence:sync', (users) => {
        expect(users).toHaveLength(1);
        expect(users[0].name).toBe('Presence User');
        client.close();
        done();
      });

      client.on('connect_error', done);
    });
  });

  it('shows both users once a second real member joins the same board', (done) => {
    signup('owner-two-users@test.com', 'Owner').then(async (owner) => {
      const { workspaceId, boardId } = await createBoardFor(owner.token);
      const member = await signup('member-two-users@test.com', 'Member');
      await inviteToWorkspace(owner.token, workspaceId, 'member-two-users@test.com');

      const clientA = connectClient(owner.token);
      let clientB;

      clientA.on('connect', () => clientA.emit('board:join', { boardId }));
      clientA.on('connect_error', done);

      clientA.on('presence:sync', (users) => {
        if (users.length === 1 && !clientB) {
          clientB = connectClient(member.token);
          clientB.on('connect', () => clientB.emit('board:join', { boardId }));
          clientB.on('connect_error', done);
        } else if (users.length === 2) {
          clientA.close();
          clientB.close();
          done();
        }
      });
    });
  });

  it('removes a user from presence after they leave the board', (done) => {
    signup('leaver@test.com').then(async ({ token }) => {
      const { boardId } = await createBoardFor(token);
      const client = connectClient(token);
      let hasJoined = false;

      client.on('connect', () => client.emit('board:join', { boardId }));
      client.on('connect_error', done);

      client.on('presence:sync', (users) => {
        if (!hasJoined && users.length === 1) {
          hasJoined = true;
          client.emit('board:leave', { boardId });
        } else if (hasJoined && users.length === 0) {
          client.close();
          done();
        }
      });
    });
  });

  it('removes a user from presence when their socket disconnects', (done) => {
    signup('watcher-owner@test.com', 'Watcher').then(async (owner) => {
      const { workspaceId, boardId } = await createBoardFor(owner.token);
      const vanisher = await signup('vanisher@test.com', 'Vanisher');
      await inviteToWorkspace(owner.token, workspaceId, 'vanisher@test.com');

      const watcher = connectClient(owner.token);
      const vanisherClient = connectClient(vanisher.token);
      let vanisherJoined = false;

      watcher.on('connect_error', done);
      vanisherClient.on('connect_error', done);

      vanisherClient.on('connect', () => vanisherClient.emit('board:join', { boardId }));
      watcher.on('connect', () => watcher.emit('board:join', { boardId }));

      watcher.on('presence:sync', (users) => {
        if (users.length === 2 && !vanisherJoined) {
          vanisherJoined = true;
          vanisherClient.close();
        } else if (users.length === 1 && vanisherJoined) {
          expect(users[0].name).toBe('Watcher');
          watcher.close();
          done();
        }
      });
    });
  });
});