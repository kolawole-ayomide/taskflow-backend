const router = require('express').Router();
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/auth.middleware');
const { avatarUpload } = require('../middlewares/upload.middleware');

router.use(authenticate);

router.patch('/profile', userController.updateProfile);

router.post(
  '/avatar',
  avatarUpload,
  // Multer's own errors (wrong file type, too large) arrive here as a passed-in
  // error rather than throwing — catch them explicitly and respond 400 instead
  // of letting them fall through to the generic 500 handler.
  (err, req, res, next) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  },
  userController.uploadAvatar
);

router.delete('/avatar', userController.removeAvatar);

module.exports = router;