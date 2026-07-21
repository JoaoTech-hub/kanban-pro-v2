import { useState, useCallback } from "react";
import api from "../services/api";

export function normalizarColuna(coluna) {
  return { ...coluna, titulo: coluna.nome };
}

export function normalizarCard(card) {
  return { ...card, coluna_id: card.colunaId };
}

export function useKanban(organizationId, projectId) {
  const [cards, setCards] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const base = `/organizations/${organizationId}/projects/${projectId}`;

  const carregar = useCallback(async () => {
    if (!organizationId || !projectId) return;

    setCarregando(true);
    setErro(null);
    try {
      const [resColunas, resCards] = await Promise.all([
        api.get(`${base}/colunas`),
        api.get(`${base}/cards`),
      ]);
      setColunas(resColunas.data.map(normalizarColuna));
      setCards(resCards.data.map(normalizarCard));
    } catch (e) {
      console.error(e);
      setErro("Falha ao carregar dados. Verifique sua conexão.");
    } finally {
      setCarregando(false);
    }
  }, [base, organizationId, projectId]);

  const moverCard = useCallback(
    async (cardId, colunaDestino, ordemDestino) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, coluna_id: colunaDestino, ordem: ordemDestino } : c
        )
      );
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