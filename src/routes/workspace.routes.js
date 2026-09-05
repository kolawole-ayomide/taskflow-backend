const router = require('express').Router();
const workspaceController = require('../controllers/workspace.controller');
const authenticate = require('../middlewares/auth.middleware');
const checkWorkspaceRole = require('../middlewares/rbac.middleware');

router.use(authenticate);

router.get('/', workspaceController.getMine);
router.post('/', workspaceController.create);
router.patch('/:id', checkWorkspaceRole(['OWNER', 'ADMIN']), workspaceController.update);
router.post('/:id/invite', checkWorkspaceRole(['OWNER', 'ADMIN']), workspaceController.invite);
router.delete('/:id', checkWorkspaceRole(['OWNER']), workspaceController.remove);

module.exports = router;