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

// Mesma consulta de findByUserAndOrg, mas já trazendo a organização junto
// num único JOIN — usado por requireOrganization, que antes fazia duas
// consultas separadas (organization.findById + este findByUserAndOrg) a
// cada requisição autenticada de organização. Reduz 1 ida ao banco por
// request em toda a API, sem mudar nenhum contrato externo.
function findByUserAndOrgComOrganizacao(userId, organizationId) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: { organization: true },
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

// Atualização condicional: só efetiva a troca de role se, no momento exato
// desta operação, a role atual ainda for `roleEsperado`. Mesmo padrão atômico
// já usado em organizationInvite.repository.js (markAsAcceptedIfValid) —
// usado pela transferência de ownership pra nunca sobrescrever silenciosamente
// um estado que mudou entre a checagem e a escrita (ex.: alvo já não é mais
// quem se pensava, ou já saiu da organização).
async function updateRoleSeAtual(organizationId, userId, roleEsperado, novoRole, client = prisma) {
  const resultado = await client.organizationMember.updateMany({
    where: { organizationId, userId, role: roleEsperado },
    data: { role: novoRole },
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
  findByUserAndOrgComOrganizacao,
  findFirstByUser,
  findAllByUser,
  findManyByOrganization,
  countByOrganization,
  updateRole,
  updateRoleSeAtual,
  remove,
};