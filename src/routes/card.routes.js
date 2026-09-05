const router = require('express').Router();
const cardController = require('../controllers/card.controller');
const commentController = require('../controllers/comment.controller');
const authenticate = require('../middlewares/auth.middleware');
const checkWorkspaceRole = require('../middlewares/rbac.middleware');

router.use(authenticate);

router.patch(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromCard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  cardController.update
);
router.delete(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromCard,
  checkWorkspaceRole(['OWNER', 'ADMIN']),
  cardController.remove
);

router.get(
  '/:id/comments',
  checkWorkspaceRole.loadWorkspaceFromCard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  commentController.getForCard
);
router.post(
  '/:id/comments',
  checkWorkspaceRole.loadWorkspaceFromCard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  commentController.create
);

module.exports = router;