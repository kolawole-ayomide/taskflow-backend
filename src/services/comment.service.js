const prisma = require('../config/db');

const createComment = async ({ cardId, authorId, content }) => {
  const comment = await prisma.comment.create({
    data: { cardId, authorId, content },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      card: { select: { title: true, list: { select: { boardId: true } } } },
    },
  });
  return comment;
};

const getCardComments = async (cardId) => {
  const comments = await prisma.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return comments;
};

const deleteComment = async ({ commentId, requestingUserId }) => {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });

  if (!comment) {
    const notFoundError = new Error('Comment not found');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  if (comment.authorId !== requestingUserId) {
    const forbiddenError = new Error('You can only delete your own comments');
    forbiddenError.statusCode = 403;
    throw forbiddenError;
  }

  await prisma.comment.delete({ where: { id: commentId } });
};

module.exports = { createComment, getCardComments, deleteComment };