const prisma = require("../config/db");
const colunaRepository = require("../repositories/coluna.repository");
const { NotFoundError } = require("../shared/errors/AppError");
const { garantirPapelGerencial } = require("../shared/authorization");

function listar(organizationId, projectId) {
  return colunaRepository.findAllByProject(organizationId, projectId);
}

async function criar({ organizationId, projectId, nome, organizationRole }) {
  garantirPapelGerencial(organizationRole);

  // Executa o cálculo da ordem e a criação em transação atômica com lock no projeto
  return prisma.$transaction(
    async (tx) => {
      const ordem = await colunaRepository.proximaOrdem(organizationId, projectId, tx);
      // proximaOrdem retorna null se o projeto não existe mais no momento do
      // lock (excluído concorrentemente entre a validação da rota, via
      // requireProject, e este ponto) — sem essa checagem, o create() abaixo
      // gravaria uma coluna com projectId apontando pra uma linha inexistente,
      // violando a FK (P2003 cru chegando no cliente em vez de um 404 limpo).
      if (ordem === null) throw new NotFoundError("Projeto não encontrado");

      return colunaRepository.create({ organizationId, projectId, nome, ordem }, tx);
    },
    { maxWait: 10000 }
  );
}

async function renomear({ id, organizationId, projectId, nome, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await colunaRepository.updateNome(id, organizationId, projectId, nome);
  if (resultado.count === 0) throw new NotFoundError("Coluna não encontrada");
}

// Reordena as colunas de um projeto (drag-and-drop do quadro inteiro, não
// dos cards). Liberado para qualquer membro da organização — mesma escolha
// já feita em card.service.mover ("reordenar" é uma ação colaborativa do
// dia a dia, diferente de renomear/excluir, que exigem papel gerencial.
async function mover({ id, organizationId, projectId, ordem }) {
  await prisma.$transaction(async (tx) => {
    // Trava o PROJETO (não uma coluna específica) para serializar
    // reordenações concorrentes — duas pessoas arrastando colunas ao mesmo
    // tempo não podem gerar `ordem` duplicada ou com buracos.
    const linhasProjeto = await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId} AND "organization_id" = ${organizationId} FOR UPDATE`;
    if (linhasProjeto.length === 0) throw new NotFoundError("Projeto não encontrado");

    const colunas = await tx.coluna.findMany({
      where: { organizationId, projectId },
      orderBy: { ordem: "asc" },
    });

    if (!colunas.some((c) => c.id === id)) {
      throw new NotFoundError("Coluna não encontrada");
    }

    const idsSemMovida = colunas.filter((c) => c.id !== id).map((c) => c.id);
    // Clampa a posição pedida para um índice válido, igual ao mover de card.
    const indice = Math.max(0, Math.min(ordem, idsSemMovida.length));
    idsSemMovida.splice(indice, 0, id);

    await Promise.all(
      idsSemMovida.map((colunaId, novaOrdem) =>
        tx.coluna.update({ where: { id: colunaId }, data: { ordem: novaOrdem } })
      )
    );
  });
}

async function remover({ id, organizationId, projectId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await colunaRepository.deleteByIdAndProject(id, organizationId, projectId);
  if (resultado.count === 0) throw new NotFoundError("Coluna não encontrada");
}

// Usado pelo módulo de cards para validar que uma coluna pertence
// à organização E ao projeto certos antes de vincular um card a ela.
// Não exige role — é usado também por quem só está visualizando/criando card.
async function validarPertencimento(colunaId, organizationId, projectId) {
  const coluna = await colunaRepository.findByIdAndProject(colunaId, organizationId, projectId);
  if (!coluna) throw new NotFoundError("Coluna não encontrada");
  return coluna;
}

module.exports = { listar, criar, renomear, mover, remover, validarPertencimento };