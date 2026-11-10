import { useState, useCallback, useRef, useLayoutEffect } from "react";
import api from "../services/api";

export function normalizarColuna(coluna) {
  return { ...coluna, titulo: coluna.nome };
}

export function normalizarCard(card) {
  return { ...card, coluna_id: card.colunaId };
}

// Recalcula localmente a sequência de `ordem` das coluna(s) afetadas por um
// movimento, do mesmo jeito que o backend recalcula (0..n-1, densa, sem
// buracos nem duplicatas) — mas de forma simples e síncrona, direto no
// array de cards já em memória, sem tx/lock (isso é só o otimista; a fonte
// de verdade continua sendo o backend, e `moverCard` já recarrega tudo do
// zero via `carregar()` se a requisição falhar).
//
// `indiceDestino` tem o mesmo significado do `ordem` enviado pra API: a
// posição (0-based) que o card deve ocupar dentro da coluna de destino,
// já sem contar o próprio card sendo movido.
export function moverCardNoEstado(cards, cardId, colunaDestinoId, indiceDestino) {
  const cardMovido = cards.find((c) => c.id === cardId);
  if (!cardMovido) return cards;

  const colunaOrigemId = cardMovido.coluna_id;
  const mesmaColuna = colunaOrigemId === colunaDestinoId;

  // IDs da coluna de destino, já ordenados pela `ordem` atual, sem o card
  // movido (ele é reinserido logo abaixo, na posição pedida).
  const idsDestino = cards
    .filter((c) => c.coluna_id === colunaDestinoId && c.id !== cardId)
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => c.id);

  const indice = Math.max(0, Math.min(indiceDestino, idsDestino.length));
  idsDestino.splice(indice, 0, cardId);

  const novaOrdemPorId = new Map(idsDestino.map((id, index) => [id, index]));

  // Coluna de origem só precisa ser recompactada separadamente quando é
  // diferente da de destino — do contrário, `idsDestino` acima já é a
  // sequência completa e final da (única) coluna envolvida.
  if (!mesmaColuna) {
    const idsOrigem = cards
      .filter((c) => c.coluna_id === colunaOrigemId && c.id !== cardId)
      .sort((a, b) => a.ordem - b.ordem)
      .map((c) => c.id);

    idsOrigem.forEach((id, index) => novaOrdemPorId.set(id, index));
  }

  return cards.map((c) => {
    if (c.id === cardId) {
      return { ...c, coluna_id: colunaDestinoId, ordem: novaOrdemPorId.get(cardId) };
    }
    if (novaOrdemPorId.has(c.id)) {
      return { ...c, ordem: novaOrdemPorId.get(c.id) };
    }
    return c;
  });
}

export function useKanban(organizationId, projectId) {
  const [cards, setCards] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const geracaoCarregamento = useRef(0);

  // Descarta o quadro em memória DURANTE o render quando a organização ou
  // projeto muda (logout, login com outra conta ou troca de contexto) — mesmo
  // padrão de useProjetos.js para o projectId (docs do React: "Adjusting
  // state when a prop changes"). Sem isso, este hook (montado uma única
  // vez acima do <Routes>, via KanbanProvider) continuava guardando as
  // colunas/cards da conta anterior: carregar() só sobrescreve quando
  // consegue buscar, e retorna sem fazer nada se projectId for nulo (caso
  // de uma conta nova, ainda sem projeto). Resultado: o quadro da conta
  // antiga aparecia por um instante para a conta nova.
  const [contextoAnterior, setContextoAnterior] = useState({ organizationId, projectId });
  if (organizationId !== contextoAnterior.organizationId || projectId !== contextoAnterior.projectId) {
    setContextoAnterior({ organizationId, projectId });
    setCards([]);
    setColunas([]);
    setErro(null);
    setCarregando(false);
  }

  useLayoutEffect(() => {
    geracaoCarregamento.current += 1;
  }, [organizationId, projectId]);

  const base = `/organizations/${organizationId}/projects/${projectId}`;

  const carregar = useCallback(async () => {
    if (!organizationId || !projectId) return;

    const geracaoAtual = ++geracaoCarregamento.current;
    const contextoDaRequisicao = { organizationId, projectId };
    const requisicaoAindaAtual = () =>
      geracaoAtual === geracaoCarregamento.current &&
      contextoDaRequisicao.organizationId === contextoAnterior.organizationId &&
      contextoDaRequisicao.projectId === contextoAnterior.projectId;

    setCarregando(true);
    setErro(null);
    try {
      const [resColunas, resCards] = await Promise.all([
        api.get(`${base}/colunas`),
        api.get(`${base}/cards`),
      ]);
      if (!requisicaoAindaAtual()) return;
      setColunas(resColunas.data.map(normalizarColuna));
      setCards(resCards.data.map(normalizarCard));
    } catch (e) {
      if (!requisicaoAindaAtual()) return;
      console.error(e);
      setErro("Falha ao carregar dados. Verifique sua conexão.");
    } finally {
      if (requisicaoAindaAtual()) setCarregando(false);
    }
  }, [base, organizationId, projectId, contextoAnterior]);

  const moverCard = useCallback(
    async (cardId, colunaDestino, ordemDestino) => {
      // Otimista: recompacta a(s) coluna(s) envolvida(s) inteira(s), não só
      // o card arrastado — evita `ordem` duplicada no estado local entre o
      // clique e a resposta do servidor.
      setCards((prev) => moverCardNoEstado(prev, cardId, colunaDestino, ordemDestino));
      try {
        await api.patch(`${base}/cards/${cardId}/mover`, {
          colunaId: colunaDestino,
          ordem: ordemDestino,
        });
      } catch (e) {
        console.error(e);
        await carregar();
      }
    },
    [base, carregar]
  );

  return { cards, colunas, carregando, erro, carregar, moverCard, setCards, setColunas };
}
