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
// Aceita um `tx` opcional: usado pela movimentação (mover()), que precisa
// reler o card DENTRO da transação, depois das colunas já travadas, para
// nunca decidir a coluna de origem com base numa leitura feita fora do lock.
function findByIdAndProject(id, organizationId, projectId, tx = prisma) {
  return tx.card.findFirst({
    where: { id, organizationId, coluna: { projectId } },
  });
}

// Todos os cards de uma coluna, ordenados por `ordem` — usado pela
// movimentação (mover()) para recalcular a sequência inteira da coluna de
// origem e/ou destino. Sempre chamado DEPOIS de lockColunasParaReordenar,
// então a leitura já reflete o estado "congelado" pela trava.
function findAllByColuna(organizationId, colunaId, tx = prisma) {
  return tx.card.findMany({
    where: { organizationId, colunaId },
    orderBy: { ordem: "asc" },
  });
}

// Trava (FOR UPDATE) uma ou mais colunas, sempre na mesma ordem determinística
// (ascendente por id) — mesmo padrão de lock que já existia só para a coluna
// de destino, agora estendido para cobrir também a coluna de origem quando a
// movimentação troca de coluna. A ordem fixa é o que evita deadlock: duas
// movimentações concorrentes envolvendo as mesmas duas colunas em sentidos
// opostos (A->B numa requisição, B->A na outra) sempre tentam adquirir as
// travas na mesma sequência, então uma delas simplesmente espera a outra
// terminar, em vez de as duas ficarem esperando uma pela outra.
async function lockColunasParaReordenar(organizationId, colunaIds, tx) {
  const idsOrdenados = [...new Set(colunaIds)].sort();
  for (const id of idsOrdenados) {
    await tx.$executeRaw`SELECT id FROM "colunas" WHERE id = ${id} AND "organization_id" = ${organizationId} FOR UPDATE`;
  }
}

// Atualiza coluna + ordem de um único card — usado pela movimentação depois
// de recalcular a nova sequência. Opera só por `id` (chave primária): não
// precisa repetir o filtro por organizationId/projectId aqui porque quem
// chama já leu e validou esse card (findByIdAndProject) dentro da mesma
// transação, com as colunas envolvidas já travadas — organizationId de um
// card nunca muda depois de criado.
function updateOrdem(id, colunaId, ordem, tx) {
  return tx.card.update({ where: { id }, data: { colunaId, ordem } });
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
  findAllByColuna,
  lockColunasParaReordenar,
  updateOrdem,
  proximaOrdem,
  create,
  updateById,
  deleteByIdAndProject,
};