const prisma = require('../src/config/db');

const cleanDatabase = async () => {
  await prisma.comment.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.card.deleteMany();
  await prisma.list.deleteMany();
  await prisma.board.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
};

afterAll(async () => {
  await prisma.$disconnect();
});

module.exports = { cleanDatabase, prisma };