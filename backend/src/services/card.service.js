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

  const ordem = await cardRepository.proximaOrdem(organizationId, colunaId);

  return cardRepository.create({
    organizationId,
    colunaId,
    titulo,
    descricao,
    prioridade,
    prazo,
    ordem,
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

async function mover({ id, organizationId, projectId, colunaId, ordem, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  await colunaService.validarPertencimento(colunaId, organizationId, projectId);

  const resultado = await cardRepository.updateById(id, organizationId, projectId, { colunaId, ordem });
  if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
}

async function remover({ id, organizationId, projectId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await cardRepository.deleteByIdAndProject(id, organizationId, projectId);
  if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
}

module.exports = { listar, criar, atualizar, mover, remover };