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

// Calcula a próxima `ordem` disponível pras colunas de um projeto, travando
// a linha do PROJETO antes (FOR UPDATE) — não a de uma coluna, já que é o
// projeto quem serializa a criação de colunas dentro dele. Se o projeto não
// existir mais no momento do lock (excluído concorrentemente entre a
// validação da rota e esta chamada), retorna `null` em vez de seguir
// calculando uma ordem pra um projeto morto — sem isso, a coluna seria
// criada apontando pra um projectId inexistente, violando a FK (P2003 cru).
// Quem chama precisa tratar esse `null` como "projeto não encontrado".
async function proximaOrdem(organizationId, projectId, tx = prisma) {
  if (tx !== prisma) {
    const linhas = await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId} AND "organization_id" = ${organizationId} FOR UPDATE`;
    if (linhas.length === 0) return null;
  }

  const resultado = await tx.coluna.aggregate({
    where: { organizationId, projectId },
    _max: { ordem: true },
  });
  return (resultado._max.ordem ?? -1) + 1;
}

function create({ organizationId, projectId, nome, ordem }, tx = prisma) {
  return tx.coluna.create({ data: { organizationId, projectId, nome, ordem } });
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