const cardService = require('../services/card.service');
const activityService = require('../services/activity.service');
const { getIO } = require('../sockets/socket.manager');

const create = async (req, res, next) => {
  try {
    const { title, position } = req.body;
    if (!title || position === undefined) {
      return res.status(400).json({ message: 'Title and position are required' });
    }

    const card = await cardService.createCard({ listId: req.params.id, title, position });

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
    const { listId, sourceListId, position, title, description, dueDate, assigneeIds, labels } = req.body;
    const card = await cardService.updateCard({
      cardId: req.params.id,
      listId,
      position,
      title,
      description,
      dueDate,
      assigneeIds,
      labels,
    });

    const boardId = card.list.boardId;
    const isMove = listId !== undefined;

    const io = getIO();
    if (io) {
      io.to(boardId).emit(isMove ? 'card:moved' : 'card:updated', isMove
        ? { cardId: card.id, sourceListId, targetListId: card.listId, newPosition: card.position, updatedBy: req.user.id }
        : { cardId: card.id, fields: req.body, updatedBy: req.user.id });
    }

    await activityService.logActivity({
      boardId,
      cardId: card.id,
      userId: req.user.id,
      action: isMove
        ? `${req.user.name} moved card "${card.title}"`
        : `${req.user.name} updated card "${card.title}"`,
    });

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

module.exports = { create, update, remove };