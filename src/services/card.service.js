const prisma = require('../config/db');

const createCard = async ({ listId, title, position }) => {
  const card = await prisma.card.create({
    data: { listId, title, position },
    include: { list: { select: { boardId: true } } },
  });
  return card;
};

const updateCard = async ({ cardId, listId, position, title, description, dueDate, assigneeIds, labels }) => {
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
      list: { select: { boardId: true } },
    },
  });

  // Flatten the join-table rows back into a plain list of users, so the API
  // response shape is unchanged from before this was an explicit join table.
  card.assignees = card.assignees.map((assignee) => assignee.user);
  return card;
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