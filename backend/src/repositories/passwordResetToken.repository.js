const crypto = require("crypto");
const prisma = require("../config/db");

function hashToken(tokenBruto) {
  return crypto.createHash("sha256").update(tokenBruto).digest("hex");
}

function create({ userId, tokenBruto, expiresAt }) {
  return prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(tokenBruto), expiresAt },
  });
}

// Só retorna um token que ainda não foi usado E ainda não expirou —
// qualquer outra situação (usado, expirado, inexistente) é tratada
// como "inválido" pelo service, sem distinguir o motivo pro cliente.
function findValidByToken(tokenBruto) {
  const tokenHash = hashToken(tokenBruto);
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  });
}

// Atômico: só marca como usado — e só retorna sucesso — se, no exato
// momento desta operação no banco, o token ainda estiver com usedAt: null.
// Isso fecha a janela de corrida entre "checar se é válido" e "marcar como
// usado": se duas requisições com o mesmo token chegarem quase juntas (ex.:
// duplo clique no botão antes dele desabilitar), o banco garante que só uma
// delas consegue de fato reivindicar o token — a outra recebe count: 0 e
// deve ser tratada como token inválido, mesmo que o SELECT anterior (findValidByToken)
// tenha visto o token como válido para ambas.
async function markAsUsedIfValid(id) {
  const resultado = await prisma.passwordResetToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return resultado.count > 0;
}

// Invalida qualquer token pendente do usuário — evita ter múltiplos
// tokens de reset válidos ao mesmo tempo (ex: usuário pede reset 3 vezes seguidas).
function invalidateAllForUser(userId) {
  return prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

module.exports = { create, findValidByToken, markAsUsedIfValid, invalidateAllForUser };