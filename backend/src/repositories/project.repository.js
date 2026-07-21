const prisma = require("../config/db");

function countByOrganization(organizationId, client = prisma) {
  return client.project.count({ where: { organizationId } });
}

function create({ organizationId, name, type }, client = prisma) {
  return client.project.create({ data: { organizationId, name, type } });
}

// Executa o count e a busca paginada na mesma transação de leitura para performance
function findAllByOrganization(organizationId, { skip = 0, take = 20 } = {}) {
  return prisma.$transaction([
    prisma.project.count({
      where: { organizationId },
    }),
    prisma.project.findMany({
      where: { organizationId },
      skip,
      take,
      orderBy: { createdAt: "asc" },
    }),
  ]).then(([total, projetos]) => ({ total, projetos }));
}

// Sempre filtra por organizationId junto do id — nunca busca por id sozinho.
// Isso é o que impede um usuário de acessar projeto de outra organização
// mesmo sabendo/adivinhando o UUID.
function findByIdAndOrganization(id, organizationId) {
  return prisma.project.findFirst({ where: { id, organizationId } });
}

function deleteByIdAndOrganization(id, organizationId) {
  return prisma.project.deleteMany({ where: { id, organizationId } });
}

function renomear(id, organizationId, name) {
  return prisma.project.updateMany({
    where: { id, organizationId },
    data: { name },
  });
}

module.exports = {
  countByOrganization,
  create,
  findAllByOrganization,
  findByIdAndOrganization,
  deleteByIdAndOrganization,
  renomear,
};