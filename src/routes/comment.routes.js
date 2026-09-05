const router = require('express').Router();
const commentController = require('../controllers/comment.controller');
const authenticate = require('../middlewares/auth.middleware');

router.use(authenticate);

router.delete('/:commentId', commentController.remove);

module.exports = router;