const cron = require('node-cron');
const prisma = require('../config/db');
const notificationService = require('../services/notification.service');

// The actual check, exported separately from the cron wrapper below so it can
// be called directly and tested without waiting for a real scheduled tick.
const checkDueDateReminders = async () => {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingCards = await prisma.card.findMany({
    where: { dueDate: { gte: now, lte: in24Hours } },
    include: {
      assignees: { select: { userId: true } },
      list: { select: { boardId: true, board: { select: { title: true } } } },
    },
  });

  for (const card of upcomingCards) {
    for (const assignee of card.assignees) {
      // Dedupe: don't send a fresh "due soon" reminder every single day the
      // card stays in the window — only once per card per assignee.
      const alreadyNotified = await prisma.notification.findFirst({
        where: { recipientId: assignee.userId, cardId: card.id, verb: 'due_soon' },
      });
      if (alreadyNotified) continue;

      await notificationService.createNotification({
        recipientId: assignee.userId,
        actorId: null,
        verb: 'due_soon',
        cardId: card.id,
        cardTitle: card.title,
        boardId: card.list.boardId,
        boardName: card.list.board.title,
      });
    }
  }
};

// Runs once a day at 8am server time — a due-date reminder is a daily digest,
// not something that needs real-time precision. Only called from server.js,
// never from app.js, so tests (which require app.js directly) never schedule this.
const startDueDateReminderJob = () => {
  cron.schedule('0 8 * * *', () => {
    checkDueDateReminders().catch((error) => {
      console.error('[due-date-reminders] Failed to run:', error.message);
    });
  });
};

module.exports = { startDueDateReminderJob, checkDueDateReminders };