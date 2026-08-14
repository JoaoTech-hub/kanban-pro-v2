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

// Aplica a nova sequência (dense, 0..n-1) de uma coluna. `cardsConhecidos` é
// o estado (id/colunaId/ordem) já lido dentro da transação — usado só para
// pular updates que não mudam nada (card já está exatamente onde deveria).
// `idsEmOrdemFinal` é a lista de ids na ordem final desejada: o índice de
// cada id nesse array É a nova ordem.
async function aplicarNovaOrdem(tx, cardsConhecidos, idsEmOrdemFinal, colunaId) {
  const porId = new Map(cardsConhecidos.map((c) => [c.id, c]));
  for (let novaOrdem = 0; novaOrdem < idsEmOrdemFinal.length; novaOrdem++) {
    const id = idsEmOrdemFinal[novaOrdem];
    const atual = porId.get(id);
    const mudou = !atual || atual.ordem !== novaOrdem || atual.colunaId !== colunaId;
    if (mudou) {
      await cardRepository.updateOrdem(id, colunaId, novaOrdem, tx);
    }
  }
}

async function mover({ id, organizationId, projectId, colunaId, ordem }) {
  // Permissão liberada para membros da organização (a validação de membro é feita pelo middleware requireOrganization)
  const colunaDestino = await colunaService.validarPertencimento(colunaId, organizationId, projectId);

  await prisma.$transaction(
    async (tx) => {
      // Relê o card DENTRO da transação (não usa nenhum valor lido antes
      // dela) para descobrir a coluna de origem real no momento do lock —
      // nunca a partir de uma leitura feita antes de travar nada.
      const card = await cardRepository.findByIdAndProject(id, organizationId, projectId, tx);
      if (!card) throw new NotFoundError("Tarefa não encontrada");

      const colunaOrigemId = card.colunaId;
      const colunaDestinoId = colunaDestino.id;

      // Trava (FOR UPDATE) a(s) coluna(s) envolvida(s) — origem e destino,
      // se forem diferentes — sempre na mesma ordem determinística. Mesma
      // trava que já existia (evita duas movimentações concorrentes gerarem
      // 'ordem' duplicada), agora estendida para cobrir a origem também, já
      // que mover para outra coluna precisa recompactar as duas.
      await cardRepository.lockColunasParaReordenar(
        organizationId,
        [colunaOrigemId, colunaDestinoId],
        tx
      );

      if (colunaOrigemId === colunaDestinoId) {
        // Caso 1: reordenar dentro da mesma coluna.
        const cardsAtuais = await cardRepository.findAllByColuna(organizationId, colunaOrigemId, tx);
        const idsSemMovido = cardsAtuais.filter((c) => c.id !== id).map((c) => c.id);

        // Clampa a posição pedida para um índice válido (0..n) em vez de
        // confiar cegamente no valor enviado pelo cliente.
        const indice = Math.max(0, Math.min(ordem, idsSemMovido.length));
        idsSemMovido.splice(indice, 0, id);

        await aplicarNovaOrdem(tx, cardsAtuais, idsSemMovido, colunaOrigemId);
      } else {
        // Caso 2: mover para outra coluna — origem e destino são
        // recompactadas juntas, na mesma transação.
        const cardsOrigem = await cardRepository.findAllByColuna(organizationId, colunaOrigemId, tx);
        const cardsDestino = await cardRepository.findAllByColuna(organizationId, colunaDestinoId, tx);

        const idsOrigem = cardsOrigem.filter((c) => c.id !== id).map((c) => c.id);

        const idsDestino = cardsDestino.map((c) => c.id);
        const indice = Math.max(0, Math.min(ordem, idsDestino.length));
        idsDestino.splice(indice, 0, id);

        await aplicarNovaOrdem(tx, cardsOrigem, idsOrigem, colunaOrigemId);
        // `card` (lido no início, ainda com colunaId/ordem antigos) entra na
        // lista de "conhecidos" do destino só para garantir que ele sempre
        // seja atualizado (colunaId dele nunca bate com colunaDestinoId).
        await aplicarNovaOrdem(tx, [...cardsDestino, card], idsDestino, colunaDestinoId);
      }
    },
    { timeout: 15000 }
  );
}

async function remover({ id, organizationId, projectId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await cardRepository.deleteByIdAndProject(id, organizationId, projectId);
  if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
}

module.exports = { listar, criar, atualizar, mover, remover };