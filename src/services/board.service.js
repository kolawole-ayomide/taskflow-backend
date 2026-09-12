const prisma = require('../config/db');

const createBoard = async ({ title, workspaceId, description, color }) => {
  const board = await prisma.board.create({
    data: { title, workspaceId, description, color },
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
              assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
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

  // Flatten each card's join-table assignee rows back into a plain user list,
  // so the response shape matches what it was before this became an explicit join table.
  board.lists.forEach((list) => {
    list.cards.forEach((card) => {
      card.assignees = card.assignees.map((assignee) => assignee.user);
    });
  });

  return board;
};

const updateBoard = async ({ boardId, title, description, color }) => {
  const board = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
    },
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

const getWorkspaceBoards = async (workspaceId) => {
  const boards = await prisma.board.findMany({
    where: { workspaceId },
    include: {
      lists: { select: { _count: { select: { cards: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return boards.map((board) => ({
    id: board.id,
    title: board.title,
    description: board.description,
    color: board.color,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    cardCount: board.lists.reduce((sum, list) => sum + list._count.cards, 0),
  }));
};

module.exports = {
  createBoard,
  getBoardById,
  updateBoard,
  deleteBoard,
  getWorkspaceBoards,
  createList,
  updateList,
  deleteList,
};