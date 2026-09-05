const commentService = require('../services/comment.service');
const activityService = require('../services/activity.service');
const { getIO } = require('../sockets/socket.manager');

const create = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await commentService.createComment({
      cardId: req.params.id,
      authorId: req.user.id,
      content,
    });

    const boardId = comment.card.list.boardId;
    const io = getIO();
    if (io) {
      io.to(boardId).emit('comment:created', { cardId: comment.cardId, comment });
    }

    await activityService.logActivity({
      boardId,
      cardId: comment.cardId,
      userId: req.user.id,
      action: `${req.user.name} commented on card "${comment.card.title}"`,
    });

    return res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

const getForCard = async (req, res, next) => {
  try {
    const comments = await commentService.getCardComments(req.params.id);
    return res.status(200).json(comments);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await commentService.deleteComment({
      commentId: req.params.commentId,
      requestingUserId: req.user.id,
    });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getForCard, remove };