const prisma = require('../config/db');

const checkWorkspaceRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const workspaceId = (req.body && req.body.workspaceId) || req.params.workspaceId || req.params.id;

      if (!workspaceId) {
        return res.status(400).json({ message: 'Workspace ID is required' });
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId },
        },
      });

      if (!membership) {
        return res.status(403).json({ message: 'You are not a member of this workspace' });
      }

      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      req.membership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
};

const getBoardWorkspaceId = async (boardId) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true },
  });
  return board?.workspaceId;
};

const getListWorkspaceId = async (listId) => {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { board: { select: { workspaceId: true } } },
  });
  return list?.board?.workspaceId;
};

const loadWorkspaceFromBoard = async (req, res, next) => {
  try {
    const workspaceId = await getBoardWorkspaceId(req.params.id);
    if (!workspaceId) return res.status(404).json({ message: 'Board not found' });
    req.body = req.body || {};
    req.body.workspaceId = workspaceId;
    next();
  } catch (error) {
    next(error);
  }
};

const loadWorkspaceFromList = async (req, res, next) => {
  try {
    const workspaceId = await getListWorkspaceId(req.params.id);
    if (!workspaceId) return res.status(404).json({ message: 'List not found' });
    req.body = req.body || {};
    req.body.workspaceId = workspaceId;
    next();
  } catch (error) {
    next(error);
  }
};

const getCardWorkspaceId = async (cardId) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { board: { select: { workspaceId: true } } } } },
  });
  return card?.list?.board?.workspaceId;
};

const loadWorkspaceFromCard = async (req, res, next) => {
  try {
    const workspaceId = await getCardWorkspaceId(req.params.id);
    if (!workspaceId) return res.status(404).json({ message: 'Card not found' });
    req.body = req.body || {};
    req.body.workspaceId = workspaceId;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = checkWorkspaceRole;
module.exports.loadWorkspaceFromBoard = loadWorkspaceFromBoard;
module.exports.loadWorkspaceFromList = loadWorkspaceFromList;
module.exports.loadWorkspaceFromCard = loadWorkspaceFromCard;