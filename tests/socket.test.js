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
  return res.body.token;
};

const connectClient = (token) =>
  ioClient(baseUrl, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });

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
    signup('socket-user@test.com').then((token) => {
      const client = connectClient(token);
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.close();
        done();
      });
      client.on('connect_error', done);
    });
  });

  it('broadcasts presence when a user joins a board', (done) => {
    signup('presence-user@test.com', 'Presence User').then((token) => {
      const client = connectClient(token);
      const boardId = 'test-board-presence';

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

  it('shows both users once a second client joins the same board', (done) => {
    const boardId = 'test-board-two-users';

    Promise.all([signup('user-a@test.com', 'User A'), signup('user-b@test.com', 'User B')]).then(
      ([tokenA, tokenB]) => {
        const clientA = connectClient(tokenA);
        let clientB;

        clientA.on('connect', () => clientA.emit('board:join', { boardId }));
        clientA.on('connect_error', done);

        clientA.on('presence:sync', (users) => {
          if (users.length === 1 && !clientB) {
            clientB = connectClient(tokenB);
            clientB.on('connect', () => clientB.emit('board:join', { boardId }));
            clientB.on('connect_error', done);
          } else if (users.length === 2) {
            clientA.close();
            clientB.close();
            done();
          }
        });
      }
    );
  });

  it('removes a user from presence after they leave the board', (done) => {
    signup('leaver@test.com').then((token) => {
      const client = connectClient(token);
      const boardId = 'test-board-leave';
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
    const boardId = 'test-board-disconnect';

    Promise.all([signup('watcher@test.com', 'Watcher'), signup('vanisher@test.com', 'Vanisher')]).then(
      ([watcherToken, vanisherToken]) => {
        const watcher = connectClient(watcherToken);
        const vanisher = connectClient(vanisherToken);
        let vanisherJoined = false;

        watcher.on('connect_error', done);
        vanisher.on('connect_error', done);

        vanisher.on('connect', () => vanisher.emit('board:join', { boardId }));

        watcher.on('connect', () => watcher.emit('board:join', { boardId }));

        watcher.on('presence:sync', (users) => {
          if (users.length === 2 && !vanisherJoined) {
            vanisherJoined = true;
            vanisher.close();
          } else if (users.length === 1 && vanisherJoined) {
            expect(users[0].name).toBe('Watcher');
            watcher.close();
            done();
          }
        });
      }
    );
  });
});