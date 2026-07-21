const prisma = require("../config/db");

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

function create({ name, email, passwordHash }, client = prisma) {
  return client.user.create({ data: { name, email, passwordHash } });
}

function updateName(id, name) {
  return prisma.user.update({ where: { id }, data: { name } });
}

// Incrementa tokenVersion na mesma operação — qualquer token emitido antes
// dessa troca deixa de bater com a versão atual e passa a ser rejeitado
// pelo middleware de autenticação, mesmo que ainda não tenha expirado.
function updatePasswordHash(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
}

module.exports = { findByEmail, findById, create, updateName, updatePasswordHash };