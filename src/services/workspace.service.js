const prisma = require('../config/db');
const crypto = require('crypto');
const { sendWorkspaceInviteEmail } = require('./email.service');

const createWorkspace = async ({ name, ownerId }) => {
  const workspace = await prisma.workspace.create({
    data: {
      name,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
    },
    include: { members: true },
  });

  return workspace;
};

const getUserWorkspaces = async (userId) => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
  }));
};

const updateWorkspace = async ({ workspaceId, name }) => {
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name },
  });
  return workspace;
};

const inviteMember = async ({ workspaceId, email, invitedById }) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });

    if (existingMembership) {
      const conflictError = new Error('User is already a member of this workspace');
      conflictError.statusCode = 409;
      throw conflictError;
    }

    const membership = await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId, role: 'MEMBER' },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    await sendWorkspaceInviteEmail({ to: email, workspaceName: workspace.name, existingUser: true });

    return { status: 'added', membership };
  }

  // No account yet — store a pending invite and email a signup link; it gets
  // redeemed automatically the moment this email address signs up.
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    update: { token, expiresAt },
    create: { workspaceId, email, token, expiresAt, invitedById },
  });

  await sendWorkspaceInviteEmail({ to: email, workspaceName: workspace.name, token, existingUser: false });

  return { status: 'invited', invite };
};

const deleteWorkspace = async (workspaceId) => {
  await prisma.workspace.delete({ where: { id: workspaceId } });
};

module.exports = { createWorkspace, getUserWorkspaces, updateWorkspace, inviteMember, deleteWorkspace };