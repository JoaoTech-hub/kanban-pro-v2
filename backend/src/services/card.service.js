const prisma = require("../config/db");
const cardRepository = require("../repositories/card.repository");
const colunaService = require("./coluna.service");
const { NotFoundError } = require("../shared/errors/AppError");
const { garantirPapelGerencial } = require("../shared/authorization");

function listar(organizationId, projectId) {
  return cardRepository.findAllByProject(organizationId, projectId);
}

async function criar({ organizationId, projectId, titulo, descricao, prioridade, prazo, colunaId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  await colunaService.validarPertencimento(colunaId, organizationId, projectId);

  // Executa o cálculo da ordem e a criação em transação com lock na coluna
  return prisma.$transaction(async (tx) => {
    const ordem = await cardRepository.proximaOrdem(organizationId, colunaId, tx);

    return cardRepository.create(
      {
        organizationId,
        colunaId,
        titulo,
        descricao,
        prioridade,
        prazo,
        ordem,
      },
      tx
    );
  });
}

async function atualizar({ id, organizationId, projectId, titulo, descricao, prioridade, prazo, colunaId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  await colunaService.validarPertencimento(colunaId, organizationId, projectId);

  const resultado = await cardRepository.updateById(id, organizationId, projectId, {
    titulo,
    descricao,
    prioridade,
    prazo,
    colunaId,
  });

  if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");

  return cardRepository.findByIdAndProject(id, organizationId, projectId);
}

async function mover({ id, organizationId, projectId, colunaId, ordem }) {
  // Permissão liberada para membros da organização (a validação de membro é feita pelo middleware requireOrganization)
  await colunaService.validarPertencimento(colunaId, organizationId, projectId);

  // Transação com Row Lock (FOR UPDATE) na tabela "colunas" para evitar race condition na movimentação
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "colunas" WHERE id = ${colunaId} AND "organization_id" = ${organizationId} FOR UPDATE`;

    const resultado = await cardRepository.updateById(id, organizationId, projectId, { colunaId, ordem }, tx);
    if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
  });
}

async function remover({ id, organizationId, projectId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await cardRepository.deleteByIdAndProject(id, organizationId, projectId);
  if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
}

module.exports = { listar, criar, atualizar, mover, remover };