const prisma = require('../config/db');

const createBoard = async ({ title, workspaceId }) => {
  const board = await prisma.board.create({
    data: { title, workspaceId },
  });
  return board;
};

const getBoardById = async (boardId) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: 'asc' },
        include: {
          cards: {
            orderBy: { position: 'asc' },
            include: {
              assignees: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  if (!board) {
    const notFoundError = new Error('Board not found');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return board;
};

const updateBoard = async ({ boardId, title }) => {
  const board = await prisma.board.update({
    where: { id: boardId },
    data: { title },
  });
  return board;
};

const deleteBoard = async (boardId) => {
  await prisma.board.delete({ where: { id: boardId } });
};

const deleteList = async (listId) => {
  await prisma.list.delete({ where: { id: listId } });
};

const createList = async ({ boardId, title, position }) => {
  const list = await prisma.list.create({
    data: { boardId, title, position },
  });
  return list;
};

const updateList = async ({ listId, title, position }) => {
  const list = await prisma.list.update({
    where: { id: listId },
    data: {
      ...(title !== undefined && { title }),
      ...(position !== undefined && { position }),
    },
  });
  return list;
};

module.exports = {
  createBoard,
  getBoardById,
  updateBoard,
  deleteBoard,
  createList,
  updateList,
  deleteList,
};