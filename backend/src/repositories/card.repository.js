const prisma = require("../config/db");

function findAllByProject(organizationId, projectId) {
  return prisma.card.findMany({
    where: { organizationId, coluna: { projectId } },
    orderBy: [{ colunaId: "asc" }, { ordem: "asc" }],
  });
}

// Antes filtrava só por id + organizationId — não confirmava que o card
// pertence ao projectId da URL. Agora exige o vínculo via coluna.projectId,
// fechando a lacuna de IDOR intra-tenant identificada na auditoria (A2).
function findByIdAndProject(id, organizationId, projectId) {
  return prisma.card.findFirst({
    where: { id, organizationId, coluna: { projectId } },
  });
}

async function proximaOrdem(organizationId, colunaId, tx = prisma) {
  if (tx !== prisma) {
    await tx.$executeRaw`SELECT id FROM "colunas" WHERE id = ${colunaId} AND "organization_id" = ${organizationId} FOR UPDATE`;
  }

  const resultado = await tx.card.aggregate({
    where: { organizationId, colunaId },
    _max: { ordem: true },
  });
  return (resultado._max.ordem ?? -1) + 1;
}

function create(dados, tx = prisma) {
  return tx.card.create({ data: dados });
}

function updateById(id, organizationId, projectId, dados, tx = prisma) {
  return tx.card.updateMany({
    where: { id, organizationId, coluna: { projectId } },
    data: dados,
  });
}

function deleteByIdAndProject(id, organizationId, projectId) {
  return prisma.card.deleteMany({
    where: { id, organizationId, coluna: { projectId } },
  });
}

module.exports = {
  findAllByProject,
  findByIdAndProject,
  proximaOrdem,
  create,
  updateById,
  deleteByIdAndProject,
};