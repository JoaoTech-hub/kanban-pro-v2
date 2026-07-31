const crypto = require("crypto");
const prisma = require("../config/db");

function hashToken(tokenBruto) {
  return crypto.createHash("sha256").update(tokenBruto).digest("hex");
}

function create({ organizationId, email, role, tokenBruto, invitedById, expiresAt }, client = prisma) {
  return client.organizationInvite.create({
    data: {
      organizationId,
      email,
      role,
      invitedById,
      expiresAt,
      tokenHash: hashToken(tokenBruto),
    },
  });
}

// Só retorna um convite ainda pendente (não aceito, não revogado, não
// expirado) — qualquer outra situação é tratada como "convite inválido"
// pelo service, sem distinguir o motivo pro cliente.
function findValidByToken(tokenBruto, client = prisma) {
  const tokenHash = hashToken(tokenBruto);
  return client.organizationInvite.findFirst({
    where: {
      tokenHash,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      organization: { select: { id: true, name: true, plan: true } },
      invitedBy: { select: { name: true } },
    },
  });
}

// Atômico: só marca como aceito — e só retorna sucesso — se, no momento
// exato desta operação, o convite ainda estiver pendente (mesmo padrão do
// markAsUsedIfValid do reset de senha). Fecha a janela de corrida entre
// "checar se é válido" (findValidByToken) e "aceitar", ex.: duplo clique.
async function markAsAcceptedIfValid(id, client = prisma) {
  const resultado = await client.organizationInvite.updateMany({
    where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  return resultado.count > 0;
}

// Invalida qualquer convite pendente pro mesmo e-mail na mesma organização —
// evita ter dois convites válidos ao mesmo tempo pra mesma pessoa
// (ex.: dono convida de novo, ou convida por engano com role errado).
function invalidatePendingForEmail(organizationId, email, client = prisma) {
  return client.organizationInvite.updateMany({
    where: { organizationId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function findPendingByOrganization(organizationId) {
  return prisma.organizationInvite.findMany({
    where: { organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { name: true } } },
  });
}

function findByIdAndOrganization(id, organizationId) {
  return prisma.organizationInvite.findFirst({
    where: { id, organizationId },
  });
}

async function revoke(id, organizationId) {
  const resultado = await prisma.organizationInvite.updateMany({
    where: { id, organizationId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return resultado.count > 0;
}

module.exports = {
  create,
  findValidByToken,
  markAsAcceptedIfValid,
  invalidatePendingForEmail,
  findPendingByOrganization,
  findByIdAndOrganization,
  revoke,
};