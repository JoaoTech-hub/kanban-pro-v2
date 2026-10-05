const prisma = require("../config/db");

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findById(id) {
  return prisma.user.findUnique({ where: { id } });
}

// Google Login (Etapa 1): busca por googleId é o caminho "rápido" — cobre o
// caso comum de quem já logou com Google antes. Como a coluna é nullable +
// unique, nunca há colisão entre contas tradicionais (googleId null).
function findByGoogleId(googleId) {
  return prisma.user.findUnique({ where: { googleId } });
}

function create({ name, email, passwordHash = null, googleId = null, emailVerified }, client = prisma) {
  return client.user.create({
    data: { name, email, passwordHash, googleId, emailVerified },
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

function incrementTokenVersion(id) {
  return prisma.user.updateMany({
    where: { id },
    data: { tokenVersion: { increment: 1 } },
  });
}

function updateEmailVerified(id, emailVerified) {
  return prisma.user.update({ where: { id }, data: { emailVerified } });
}

// Google Login (Etapa 1): vincula um googleId a uma conta já existente
// (criada originalmente por e-mail/senha). Não mexe em passwordHash — a
// conta continua podendo logar dos dois jeitos depois disso. Também
// aproveita pra marcar o e-mail como verificado, já que o Google confirmou
// a posse do e-mail (evita depender do fluxo de verificação por link).
function linkGoogleId(id, googleId) {
  return prisma.user.update({
    where: { id },
    data: { googleId, emailVerified: true },
  });
}

module.exports = {
  findByEmail,
  findById,
  findByGoogleId,
  create,
  updateName,
  updatePasswordHash,
  incrementTokenVersion,
  updateEmailVerified,
  linkGoogleId,
};
