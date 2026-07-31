const prisma = require("../config/db");

function create({ organizationId, userId, role = "member" }, client = prisma) {
  return client.organizationMember.create({
    data: { organizationId, userId, role },
  });
}

function findByUserAndOrg(userId, organizationId, client = prisma) {
  return client.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

function findFirstByUser(userId) {
  return prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
}

// Todas as organizações que o usuário pertence — usado pro seletor de
// organização no frontend (suporte a multi-org: um usuário pode ter sido
// convidado para mais de uma organização além da que criou no registro).
function findAllByUser(userId) {
  return prisma.organizationMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
  });
}

// Todos os membros de uma organização — usado na tela de gestão de equipe.
function findManyByOrganization(organizationId) {
  return prisma.organizationMember.findMany({
    where: { organizationId },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

function countByOrganization(organizationId, client = prisma) {
  return client.organizationMember.count({ where: { organizationId } });
}

async function updateRole(organizationId, userId, role) {
  const resultado = await prisma.organizationMember.updateMany({
    where: { organizationId, userId },
    data: { role },
  });
  return resultado.count > 0;
}

async function remove(organizationId, userId) {
  const resultado = await prisma.organizationMember.deleteMany({
    where: { organizationId, userId },
  });
  return resultado.count > 0;
}

module.exports = {
  create,
  findByUserAndOrg,
  findFirstByUser,
  findAllByUser,
  findManyByOrganization,
  countByOrganization,
  updateRole,
  remove,
};