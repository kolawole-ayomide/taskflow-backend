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

const registerBoardEvents = (io, socket) => {
  socket.on('board:join', ({ boardId }) => {
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