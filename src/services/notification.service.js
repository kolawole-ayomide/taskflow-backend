const prisma = require('../config/db');

const serialize = (n) => ({
  id: n.id,
  unread: !n.read,
  actorId: n.actorId,
  verb: n.verb,
  cardId: n.cardId,
  cardTitle: n.cardTitle,
  boardId: n.boardId,
  boardName: n.boardName,
  createdAt: n.createdAt,
});

const createNotification = async ({ recipientId, actorId, verb, cardId, cardTitle, boardId, boardName }) => {
  // Never notify someone about their own action (e.g. assigning yourself, mentioning yourself)
  if (recipientId === actorId) return null;

  return prisma.notification.create({
    data: { recipientId, actorId, verb, cardId, cardTitle, boardId, boardName },
  });
};

const getUserNotifications = async (userId) => {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'desc' },
  });
  return notifications.map(serialize);
};

const markAsRead = async ({ notificationId, userId }) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

  if (!notification || notification.recipientId !== userId) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
  return getUserNotifications(userId);
};

const markAllAsRead = async (userId) => {
  await prisma.notification.updateMany({ where: { recipientId: userId, read: false }, data: { read: true } });
  return getUserNotifications(userId);
};

module.exports = { createNotification, getUserNotifications, markAsRead, markAllAsRead };