const activityService = require('../services/activity.service');

const getForBoard = async (req, res, next) => {
  try {
    const activities = await activityService.getBoardActivity(req.params.id);
    return res.status(200).json(activities);
  } catch (error) {
    next(error);
  }
};

module.exports = { getForBoard };