const userService = require('../services/user.service');

const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await userService.updateProfile({ userId: req.user.id, name });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'An image file is required (field name: avatar)' });
    }

    const user = await userService.updateAvatar({ userId: req.user.id, buffer: req.file.buffer });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const removeAvatar = async (req, res, next) => {
  try {
    const user = await userService.removeAvatar({ userId: req.user.id });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

module.exports = { updateProfile, uploadAvatar, removeAvatar };