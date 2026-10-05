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
// Aceita um `tx` opcional para reler o card na mesma transação que mantém
// seus locks, sem decidir a coluna de origem por uma leitura desatualizada.
function findByIdAndProject(id, organizationId, projectId, tx = prisma) {
  return tx.card.findFirst({
    where: { id, organizationId, coluna: { projectId } },
  });
}

// Serializa operações concorrentes sobre o mesmo card e confirma o escopo
// organização/projeto antes de adquirir o lock da linha.
async function lockCardForUpdate(id, organizationId, projectId, tx) {
  const rows = await tx.$queryRaw`SELECT c.id FROM "cards" c INNER JOIN "colunas" col ON col.id = c.coluna_id WHERE c.id = ${id} AND c.organization_id = ${organizationId} AND col.project_id = ${projectId} FOR UPDATE OF c`;
  return rows.length > 0;
}

// Todos os cards de uma coluna, ordenados por `ordem` — usado pela edição e
// movimentação para recalcular a sequência após as colunas estarem travadas.
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
//
// Retorna os ids que REALMENTE existem e foram travados. Antes usava
// $executeRaw e descartava o resultado — se uma coluna fosse excluída
// concorrentemente entre a validação da rota (fora da transação) e este
// lock, o SELECT...FOR UPDATE simplesmente não achava nada, não travava
// nada, e nada acusava isso: o código seguia como se a coluna existisse e
// só quebrava mais adiante, com uma violação de FK crua (P2003) chegando
// direto no cliente em vez de um 404 limpo. $queryRaw devolve as linhas de
// fato encontradas, então quem chama consegue comparar com os ids
// esperados e decidir.
async function lockColunasParaReordenar(organizationId, colunaIds, tx) {
  const idsOrdenados = [...new Set(colunaIds)].sort();
  const encontrados = [];
  for (const id of idsOrdenados) {
    const linhas = await tx.$queryRaw`SELECT id FROM "colunas" WHERE id = ${id} AND "organization_id" = ${organizationId} FOR UPDATE`;
    if (linhas.length > 0) encontrados.push(id);
  }
  return encontrados;
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

// Calcula a próxima `ordem` disponível numa coluna, travando a linha da
// coluna antes (FOR UPDATE) pra serializar criações concorrentes na mesma
// coluna. Se a coluna não existir mais no momento do lock (excluída
// concorrentemente entre a validação da rota e esta chamada), retorna
// `null` em vez de seguir calculando uma ordem pra uma coluna morta — sem
// isso, o card seria criado apontando pra um colunaId inexistente,
// violando a FK (P2003 cru). Quem chama precisa tratar esse `null` como
// "coluna não encontrada".
async function proximaOrdem(organizationId, colunaId, tx = prisma) {
  if (tx !== prisma) {
    const linhas = await tx.$queryRaw`SELECT id FROM "colunas" WHERE id = ${colunaId} AND "organization_id" = ${organizationId} FOR UPDATE`;
    if (linhas.length === 0) return null;
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
  lockCardForUpdate,
  findAllByColuna,
  lockColunasParaReordenar,
  updateOrdem,
  proximaOrdem,
  create,
  updateById,
  deleteByIdAndProject,
};
