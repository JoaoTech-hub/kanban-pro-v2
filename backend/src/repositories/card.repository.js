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

async function proximaOrdem(organizationId, colunaId) {
  const resultado = await prisma.card.aggregate({
    where: { organizationId, colunaId },
    _max: { ordem: true },
  });
  return (resultado._max.ordem ?? -1) + 1;
}

function create(dados) {
  return prisma.card.create({ data: dados });
}

// Mesma correção: escopo por projectId via relação com coluna, não só organizationId.
function updateById(id, organizationId, projectId, dados) {
  return prisma.card.updateMany({
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