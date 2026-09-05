const workspaceService = require('../services/workspace.service');

const create = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Workspace name is required' });
    }

    const workspace = await workspaceService.createWorkspace({ name, ownerId: req.user.id });
    return res.status(201).json(workspace);
  } catch (error) {
    next(error);
  }
};

const getMine = async (req, res, next) => {
  try {
    const workspaces = await workspaceService.getUserWorkspaces(req.user.id);
    return res.status(200).json(workspaces);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Workspace name is required' });
    }

    const workspace = await workspaceService.updateWorkspace({ workspaceId: req.params.id, name });
    return res.status(200).json(workspace);
  } catch (error) {
    next(error);
  }
};

const getMembers = async (req, res, next) => {
  try {
    const members = await workspaceService.getWorkspaceMembers(req.params.id);
    return res.status(200).json(members);
  } catch (error) {
    next(error);
  }
};

const invite = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const result = await workspaceService.inviteMember({
      workspaceId: req.params.id,
      email,
      invitedById: req.user.id,
    });

    if (result.status === 'added') {
      return res.status(201).json(result.membership);
    }
    return res.status(202).json({ message: 'Invite sent — they will be added once they sign up.' });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await workspaceService.deleteWorkspace(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getMine, update, getMembers, invite, remove };