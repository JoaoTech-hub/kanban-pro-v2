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
  return prisma.$transaction(
    async (tx) => {
      const ordem = await cardRepository.proximaOrdem(organizationId, colunaId, tx);
      // proximaOrdem retorna null se a coluna não existe mais no momento do
      // lock (excluída concorrentemente entre a validação acima, fora da
      // transação, e este ponto) — sem essa checagem, o create() abaixo
      // gravaria um card com colunaId apontando pra uma linha inexistente,
      // violando a FK (P2003 cru chegando no cliente em vez de um 404 limpo).
      if (ordem === null) throw new NotFoundError("Coluna não encontrada");

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
    },
    { maxWait: 10000 }
  );
}

async function atualizar({ id, organizationId, projectId, titulo, descricao, prioridade, prazo, colunaId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const colunaDestino = await colunaService.validarPertencimento(colunaId, organizationId, projectId);

  await prisma.$transaction(async (tx) => {
    const cardTravado = await cardRepository.lockCardForUpdate(id, organizationId, projectId, tx);
    if (!cardTravado) throw new NotFoundError("Tarefa não encontrada");

    const card = await cardRepository.findByIdAndProject(id, organizationId, projectId, tx);
    if (!card) throw new NotFoundError("Tarefa não encontrada");

    const dados = { titulo, descricao, prioridade, prazo, colunaId: colunaDestino.id };
    if (card.colunaId === colunaDestino.id) {
      const resultado = await cardRepository.updateById(id, organizationId, projectId, dados, tx);
      if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
      return;
    }

    await travarColunasDaMovimentacao(organizationId, card.colunaId, colunaDestino.id, tx);
    const cardsOrigem = await cardRepository.findAllByColuna(organizationId, card.colunaId, tx);
    const cardsDestino = await cardRepository.findAllByColuna(organizationId, colunaDestino.id, tx);

    const resultado = await cardRepository.updateById(id, organizationId, projectId, dados, tx);
    if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");

    await aplicarNovaOrdem(
      tx,
      cardsOrigem,
      cardsOrigem.filter((c) => c.id !== id).map((c) => c.id),
      card.colunaId
    );
    await aplicarNovaOrdem(
      tx,
      [...cardsDestino, card],
      [...cardsDestino.map((c) => c.id), id],
      colunaDestino.id
    );
  }, { timeout: 15000, maxWait: 10000 });

  return cardRepository.findByIdAndProject(id, organizationId, projectId);
}

async function travarColunasDaMovimentacao(organizationId, colunaOrigemId, colunaDestinoId, tx) {
  const idsEsperados = [...new Set([colunaOrigemId, colunaDestinoId])];
  const idsTravados = await cardRepository.lockColunasParaReordenar(organizationId, idsEsperados, tx);
  if (idsTravados.length !== idsEsperados.length) throw new NotFoundError("Coluna não encontrada");
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
      // Serializa movimentações do mesmo card antes de descobrir a origem.
      const cardTravado = await cardRepository.lockCardForUpdate(id, organizationId, projectId, tx);
      if (!cardTravado) throw new NotFoundError("Tarefa não encontrada");
      const card = await cardRepository.findByIdAndProject(id, organizationId, projectId, tx);
      if (!card) throw new NotFoundError("Tarefa não encontrada");

      const colunaOrigemId = card.colunaId;
      const colunaDestinoId = colunaDestino.id;

      // Trava (FOR UPDATE) a(s) coluna(s) envolvida(s) — origem e destino,
      // se forem diferentes — sempre na mesma ordem determinística. Mesma
      // trava que já existia (evita duas movimentações concorrentes gerarem
      // 'ordem' duplicada), agora estendida para cobrir a origem também, já
      // que mover para outra coluna precisa recompactar as duas.
      await travarColunasDaMovimentacao(organizationId, colunaOrigemId, colunaDestinoId, tx);
      // Se alguma das colunas esperadas não veio de volta, ela foi excluída
      // concorrentemente entre a validação da rota (fora da transação) e
      // este lock — nunca deve prosseguir movendo o card pra uma coluna que
      // não existe mais.
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
    { timeout: 15000, maxWait: 10000 }
  );
}

async function remover({ id, organizationId, projectId, organizationRole }) {
  garantirPapelGerencial(organizationRole);
  const resultado = await cardRepository.deleteByIdAndProject(id, organizationId, projectId);
  if (resultado.count === 0) throw new NotFoundError("Tarefa não encontrada");
}

module.exports = { listar, criar, atualizar, mover, remover };
