const notificationService = require('../services/notification.service');

const getMine = async (req, res, next) => {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.id);
    return res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

const markOneRead = async (req, res, next) => {
  try {
    const notifications = await notificationService.markAsRead({
      notificationId: req.params.id,
      userId: req.user.id,
    });
    return res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const notifications = await notificationService.markAllAsRead(req.user.id);
    return res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

module.exports = { getMine, markOneRead, markAllRead };