const router = require('express').Router();
const boardController = require('../controllers/board.controller');
const activityController = require('../controllers/activity.controller');
const authenticate = require('../middlewares/auth.middleware');
const checkWorkspaceRole = require('../middlewares/rbac.middleware');

router.use(authenticate);

router.post('/', checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']), boardController.create);
router.get(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromBoard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  boardController.getById
);
router.patch(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromBoard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  boardController.update
);
router.delete(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromBoard,
  checkWorkspaceRole(['OWNER', 'ADMIN']),
  boardController.remove
);
router.post(
  '/:id/lists',
  checkWorkspaceRole.loadWorkspaceFromBoard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  boardController.createList
);
router.get(
  '/:id/activity',
  checkWorkspaceRole.loadWorkspaceFromBoard,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  activityController.getForBoard
);

module.exports = router;