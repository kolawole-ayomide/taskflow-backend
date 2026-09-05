const prisma = require('../config/db');

const logActivity = async ({ boardId, cardId, userId, action }) => {
  const activity = await prisma.activityLog.create({
    data: { boardId, cardId, userId, action },
  });
  return activity;
};

const getBoardActivity = async (boardId) => {
  const activities = await prisma.activityLog.findMany({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return activities;
};

module.exports = { logActivity, getBoardActivity };