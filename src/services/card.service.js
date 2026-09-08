const prisma = require('../config/db');

const createCard = async ({ listId, title, position }) => {
  const card = await prisma.card.create({
    data: { listId, title, position },
    include: { list: { select: { boardId: true } } },
  });
  return card;
};

const updateCard = async ({ cardId, listId, position, title, description, dueDate, assigneeIds, labels }) => {
  let previousAssigneeIds = [];
  if (assigneeIds !== undefined) {
    const existing = await prisma.cardAssignee.findMany({ where: { cardId }, select: { userId: true } });
    previousAssigneeIds = existing.map((a) => a.userId);
  }

  const card = await prisma.card.update({
    where: { id: cardId },
    data: {
      ...(listId !== undefined && { listId }),
      ...(position !== undefined && { position }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate }),
      ...(labels !== undefined && { labels }),
      ...(assigneeIds !== undefined && {
        assignees: {
          deleteMany: {},
          create: assigneeIds.map((id) => ({ user: { connect: { id } } })),
        },
      }),
    },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      list: { select: { boardId: true, board: { select: { title: true } } } },
    },
  });

  // Flatten the join-table rows back into a plain list of users, so the API
  // response shape is unchanged from before this was an explicit join table.
  card.assignees = card.assignees.map((assignee) => assignee.user);

  // Only newly-added assignees get notified — re-saving the same assignee list
  // shouldn't spam a notification every time the card is otherwise edited.
  const newlyAddedAssigneeIds =
    assigneeIds !== undefined ? assigneeIds.filter((id) => !previousAssigneeIds.includes(id)) : [];

  return { card, newlyAddedAssigneeIds };
};

const deleteCard = async (cardId) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: { select: { boardId: true } } },
  });

  if (!card) {
    const notFoundError = new Error('Card not found');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  await prisma.card.delete({ where: { id: cardId } });
  return card;
};

const searchCards = async ({ workspaceId, query, assigneeId, label, dueBefore, dueAfter }) => {
  const cards = await prisma.card.findMany({
    where: {
      list: { board: { workspaceId } },
      ...(query && {
        OR: [{ title: { contains: query } }, { description: { contains: query } }],
      }),
      ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
      ...(dueBefore && { dueDate: { lte: new Date(dueBefore) } }),
      ...(dueAfter && { dueDate: { gte: new Date(dueAfter) } }),
    },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      list: { select: { id: true, title: true, board: { select: { id: true, title: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const results = cards.map((card) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate,
    labels: card.labels,
    assignees: card.assignees.map((a) => a.user),
    listId: card.list.id,
    listName: card.list.title,
    boardId: card.list.board.id,
    boardName: card.list.board.title,
  }));

  if (!label) return results;

  // labels is an unstructured Json field, so filter in application code rather
  // than relying on MySQL's limited/inconsistent JSON-array query support.
  return results.filter((card) => Array.isArray(card.labels) && card.labels.includes(label));
};

module.exports = { createCard, updateCard, deleteCard, searchCards };