const cardService = require('../services/card.service');
const activityService = require('../services/activity.service');
const notificationService = require('../services/notification.service');
const { getIO } = require('../sockets/socket.manager');

const create = async (req, res, next) => {
  try {
    const { title, position, priority } = req.body;
    if (!title || position === undefined) {
      return res.status(400).json({ message: 'Title and position are required' });
    }

    const card = await cardService.createCard({ listId: req.params.id, title, position, priority });

    await activityService.logActivity({
      boardId: card.list.boardId,
      cardId: card.id,
      userId: req.user.id,
      action: `${req.user.name} created card "${card.title}"`,
    });

    return res.status(201).json(card);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { listId, sourceListId, position, title, description, dueDate, priority, assigneeIds, labels, workspaceId } = req.body;
    const { card, newlyAddedAssigneeIds } = await cardService.updateCard({
      cardId: req.params.id,
      workspaceId,
      listId,
      position,
      title,
      description,
      dueDate,
      priority,
      assigneeIds,
      labels,
    });

    const boardId = card.list.boardId;
    const boardTitle = card.list.board.title;
    const isMove = listId !== undefined;

    const io = getIO();
    if (io) {
      io.to(boardId).emit(isMove ? 'card:moved' : 'card:updated', isMove
        ? { cardId: card.id, sourceListId, targetListId: card.listId, newPosition: card.position, updatedBy: req.user.id }
        : {
            cardId: card.id,
            // Explicit field list rather than spreading req.body — the RBAC
            // middleware injects workspaceId into the body, which has no
            // business appearing in a broadcast payload.
            fields: { title, description, dueDate, priority, assigneeIds, labels },
            updatedBy: req.user.id,
          });
    }

    await activityService.logActivity({
      boardId,
      cardId: card.id,
      userId: req.user.id,
      action: isMove
        ? `${req.user.name} moved card "${card.title}"`
        : `${req.user.name} updated card "${card.title}"`,
    });

    // A failed notification should never fail the request — the card update
    // already succeeded and was already broadcast by this point, so an error
    // here shouldn't make the client think their edit didn't go through.
    for (const assigneeId of newlyAddedAssigneeIds) {
      try {
        await notificationService.createNotification({
          recipientId: assigneeId,
          actorId: req.user.id,
          verb: 'assigned_card',
          cardId: card.id,
          cardTitle: card.title,
          boardId,
          boardName: boardTitle,
        });
      } catch (notifyError) {
        console.error('[notifications] Failed to notify assignee:', notifyError.message);
      }
    }

    return res.status(200).json(card);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const card = await cardService.deleteCard(req.params.id);

    await activityService.logActivity({
      boardId: card.list.boardId,
      cardId: null,
      userId: req.user.id,
      action: `${req.user.name} deleted card "${card.title}"`,
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const search = async (req, res, next) => {
  try {
    const { q, assigneeId, label, dueBefore, dueAfter, limit, offset } = req.query;
    const results = await cardService.searchCards({
      workspaceId: req.params.id,
      query: q,
      assigneeId,
      label,
      dueBefore,
      dueAfter,
      // Cap limit at 100 so a client can't request an unbounded page size.
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 25,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

module.exports = { create, update, remove, search };