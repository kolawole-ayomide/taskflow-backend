const prisma = require('../config/db');

const boardPresence = new Map();

const getBoardUsers = (boardId) => {
  const map = boardPresence.get(boardId);
  if (!map) return [];
  return Array.from(map.values());
};

const leaveBoard = (io, socket, boardId) => {
  socket.leave(boardId);

  const map = boardPresence.get(boardId);
  if (map) {
    map.delete(socket.id);
    if (map.size === 0) {
      boardPresence.delete(boardId);
    }
  }

  const remainingUsers = getBoardUsers(boardId);
  io.to(boardId).emit('presence:sync', remainingUsers);
  // The socket that just left is no longer in the room, so the broadcast above
  // never reaches it — send it directly so it can confirm the leave / clear local state.
  socket.emit('presence:sync', remainingUsers);
};

// Confirms the connected user actually belongs to the workspace this board
// lives in — sockets have no other authorization layer, so this is the only
// thing stopping someone from joining any board's live room just by knowing its ID.
const isAuthorizedForBoard = async (userId, boardId) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true },
  });

  if (!board) return false;

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: board.workspaceId } },
  });

  return Boolean(membership);
};

const registerBoardEvents = (io, socket) => {
  socket.on('board:join', async ({ boardId }) => {
    const authorized = await isAuthorizedForBoard(socket.user.id, boardId);
    if (!authorized) {
      socket.emit('board:join_error', { message: 'You do not have access to this board' });
      return;
    }

    socket.join(boardId);

    if (!boardPresence.has(boardId)) {
      boardPresence.set(boardId, new Map());
    }
    boardPresence.get(boardId).set(socket.id, socket.user);
    socket.data.currentBoardId = boardId;

    io.to(boardId).emit('presence:sync', getBoardUsers(boardId));
  });

  socket.on('board:leave', ({ boardId }) => {
    leaveBoard(io, socket, boardId);
  });

  socket.on('disconnect', () => {
    if (socket.data.currentBoardId) {
      leaveBoard(io, socket, socket.data.currentBoardId);
    }
  });
};

module.exports = registerBoardEvents;