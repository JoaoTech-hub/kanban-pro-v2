const crypto = require("crypto");
const prisma = require("../config/db");

function hashToken(tokenBruto) {
  return crypto.createHash("sha256").update(tokenBruto).digest("hex");
}

function create({ userId, tokenBruto, expiresAt }) {
  return prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(tokenBruto), expiresAt },
  });
}

function findValidByToken(tokenBruto) {
  const tokenHash = hashToken(tokenBruto);
  return prisma.emailVerificationToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  });
}

async function markAsUsedIfValid(id) {
  const resultado = await prisma.emailVerificationToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return resultado.count > 0;
}

function invalidateAllForUser(userId) {
  return prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

function findMaisRecentePendente(userId) {
  return prisma.emailVerificationToken.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  create,
  findValidByToken,
  markAsUsedIfValid,
  invalidateAllForUser,
  findMaisRecentePendente,
};