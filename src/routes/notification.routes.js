const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const authenticate = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', notificationController.getMine);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markOneRead);

module.exports = router;