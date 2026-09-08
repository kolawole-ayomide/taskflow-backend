const commentService = require('../services/comment.service');
const activityService = require('../services/activity.service');
const notificationService = require('../services/notification.service');
const workspaceService = require('../services/workspace.service');
const { getIO } = require('../sockets/socket.manager');

const create = async (req, res, next) => {
  try {
    const { content, mentionedUserIds, workspaceId } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await commentService.createComment({
      cardId: req.params.id,
      authorId: req.user.id,
      content,
    });

    const boardId = comment.card.list.boardId;
    const boardTitle = comment.card.list.board.title;
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

    // mentionedUserIds comes explicitly from the client's @-mention picker,
    // which already resolves a typed name to a specific user id — this avoids
    // fragile parsing of raw comment text for "@Name" patterns server-side.
    // Anyone not actually in this workspace is silently dropped rather than
    // notified or allowed to crash the request.
    const uniqueMentionedIds = [...new Set(mentionedUserIds || [])];
    const validMentionedIds = await workspaceService.getValidMemberIds({
      workspaceId,
      userIds: uniqueMentionedIds,
    });

    // A failed notification should never fail the request — the comment
    // already succeeded and was already broadcast by this point.
    for (const mentionedId of validMentionedIds) {
      try {
        await notificationService.createNotification({
          recipientId: mentionedId,
          actorId: req.user.id,
          verb: 'mentioned',
          cardId: comment.cardId,
          cardTitle: comment.card.title,
          boardId,
          boardName: boardTitle,
        });
      } catch (notifyError) {
        console.error('[notifications] Failed to notify mentioned user:', notifyError.message);
      }
    }

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