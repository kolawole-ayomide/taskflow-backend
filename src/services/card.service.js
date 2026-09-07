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

module.exports = { createCard, updateCard, deleteCard };