const router = require('express').Router();
const boardController = require('../controllers/board.controller');
const cardController = require('../controllers/card.controller');
const authenticate = require('../middlewares/auth.middleware');
const checkWorkspaceRole = require('../middlewares/rbac.middleware');

router.use(authenticate);

router.patch(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromList,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  boardController.updateList
);
router.post(
  '/:id/cards',
  checkWorkspaceRole.loadWorkspaceFromList,
  checkWorkspaceRole(['OWNER', 'ADMIN', 'MEMBER']),
  cardController.create
);
router.delete(
  '/:id',
  checkWorkspaceRole.loadWorkspaceFromList,
  checkWorkspaceRole(['OWNER', 'ADMIN']),
  boardController.deleteList
);

module.exports = router;