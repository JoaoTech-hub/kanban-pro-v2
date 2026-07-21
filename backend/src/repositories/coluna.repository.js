const prisma = require("../config/db");

const COLUNAS_PADRAO = ["A Fazer", "Em Andamento", "Concluído"];

function createDefaults({ organizationId, projectId }, client = prisma) {
  return client.coluna.createMany({
    data: COLUNAS_PADRAO.map((nome, index) => ({
      organizationId,
      projectId,
      nome,
      ordem: index,
    })),
  });
}

function findAllByProject(organizationId, projectId) {
  return prisma.coluna.findMany({
    where: { organizationId, projectId },
    orderBy: { ordem: "asc" },
  });
}

function findByIdAndProject(id, organizationId, projectId) {
  return prisma.coluna.findFirst({ where: { id, organizationId, projectId } });
}

async function proximaOrdem(organizationId, projectId) {
  const resultado = await prisma.coluna.aggregate({
    where: { organizationId, projectId },
    _max: { ordem: true },
  });
  return (resultado._max.ordem ?? -1) + 1;
}

function create({ organizationId, projectId, nome, ordem }, client = prisma) {
  return client.coluna.create({ data: { organizationId, projectId, nome, ordem } });
}

function updateNome(id, organizationId, projectId, nome) {
  return prisma.coluna.updateMany({
    where: { id, organizationId, projectId },
    data: { nome },
  });
}

function deleteByIdAndProject(id, organizationId, projectId) {
  // onDelete: Cascade no schema já apaga os cards da coluna junto.
  return prisma.coluna.deleteMany({ where: { id, organizationId, projectId } });
}

module.exports = {
  createDefaults,
  findAllByProject,
  findByIdAndProject,
  proximaOrdem,
  create,
  updateNome,
  deleteByIdAndProject,
};