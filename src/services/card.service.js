const prisma = require('../config/db');

const createCard = async ({ listId, title, position, priority }) => {
  const card = await prisma.card.create({
    data: { listId, title, position, ...(priority !== undefined && { priority }) },
    include: { list: { select: { boardId: true } } },
  });
  return card;
};

const updateCard = async ({ cardId, workspaceId, listId, position, title, description, dueDate, priority, assigneeIds, labels }) => {
  // A card can only move within its own workspace, and only workspace members
  // can be assigned to it — neither was validated before, which meant a client
  // could silently move a card into a different workspace's board, or assign
  // it to someone with no access to it at all.
  if (listId !== undefined) {
    const targetList = await prisma.list.findUnique({
      where: { id: listId },
      select: { board: { select: { workspaceId: true } } },
    });

    if (!targetList || targetList.board.workspaceId !== workspaceId) {
      const error = new Error('Target list not found in this workspace');
      error.statusCode = 400;
      throw error;
    }
  }

  if (assigneeIds !== undefined && assigneeIds.length > 0) {
    const validMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: assigneeIds } },
      select: { userId: true },
    });

    if (validMembers.length !== assigneeIds.length) {
      const error = new Error('One or more assignees are not members of this workspace');
      error.statusCode = 400;
      throw error;
    }
  }

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
      ...(priority !== undefined && { priority }),
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

const searchCards = async ({ workspaceId, query, assigneeId, label, dueBefore, dueAfter, limit = 25, offset = 0 }) => {
  const where = {
    list: { board: { workspaceId } },
    ...(query && {
      OR: [{ title: { contains: query } }, { description: { contains: query } }],
    }),
    ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
    ...(dueBefore && { dueDate: { lte: new Date(dueBefore) } }),
    ...(dueAfter && { dueDate: { gte: new Date(dueAfter) } }),
  };

  const includeOpts = {
    assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    list: { select: { id: true, title: true, board: { select: { id: true, title: true } } } },
  };

  const mapCard = (card) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate,
    priority: card.priority,
    labels: card.labels,
    assignees: card.assignees.map((a) => a.user),
    listId: card.list.id,
    listName: card.list.title,
    boardId: card.list.board.id,
    boardName: card.list.board.title,
  });

  if (label) {
    // labels is an unstructured Json field, so filter in application code rather
    // than relying on MySQL's limited/inconsistent JSON-array query support.
    // That means pagination has to happen after filtering too, so every DB-matching
    // row is fetched here rather than a single page of them.
    const allCards = await prisma.card.findMany({
      where,
      include: includeOpts,
      orderBy: { updatedAt: 'desc' },
    });

    const filtered = allCards.map(mapCard).filter((card) => Array.isArray(card.labels) && card.labels.includes(label));
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return { items, total, hasMore: offset + items.length < total };
  }

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      include: includeOpts,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.card.count({ where }),
  ]);

  const items = cards.map(mapCard);

  return { items, total, hasMore: offset + items.length < total };
};

module.exports = { createCard, updateCard, deleteCard, searchCards };