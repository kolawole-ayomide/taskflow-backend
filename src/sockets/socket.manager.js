const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const prisma = require('../config/db');
const registerBoardEvents = require('./board.events');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, avatarUrl: true },
      });

      if (!user) {
        return next(new Error('User not found or invalid token'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    registerBoardEvents(io, socket);
  });

  return io;
};

const getIO = () => {
  return io || null;
};

module.exports = { initSocket, getIO };