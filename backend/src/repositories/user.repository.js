const prisma = require("../config/db");

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

function create({ name, email, passwordHash, emailVerified }, client = prisma) {
  return client.user.create({
    data: { name, email, passwordHash, emailVerified },
  });
}

function updateName(id, name) {
  return prisma.user.update({ where: { id }, data: { name } });
}

function updatePasswordHash(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
}

function updateEmailVerified(id, emailVerified) {
  return prisma.user.update({ where: { id }, data: { emailVerified } });
}

module.exports = {
  findByEmail,
  findById,
  create,
  updateName,
  updatePasswordHash,
  updateEmailVerified,
};