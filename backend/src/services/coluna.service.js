const colunaRepository = require("../repositories/coluna.repository");
const { NotFoundError } = require("../shared/errors/AppError");
const { garantirPapelGerencial } = require("../shared/authorization");

function listar(organizationId, projectId) {
  return colunaRepository.findAllByProject(organizationId, projectId);
}

async function criar({ organizationId, projectId, nome, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const ordem = await colunaRepository.proximaOrdem(organizationId, projectId);
  return colunaRepository.create({ organizationId, projectId, nome, ordem });
}

async function renomear({ id, organizationId, projectId, nome, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await colunaRepository.updateNome(id, organizationId, projectId, nome);
  if (resultado.count === 0) throw new NotFoundError("Coluna não encontrada");
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

module.exports = { listar, criar, renomear, remover, validarPertencimento };