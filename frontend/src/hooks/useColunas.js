import { useState, useCallback } from "react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { normalizarColuna } from "./useKanban";

export function useColunas(organizationId, projectId, { colunas, setColunas, setCards, carregar }) {
  const [salvando, setSalvando] = useState(false);
  const { showToast } = useToast();

  const base = `/organizations/${organizationId}/projects/${projectId}`;

  const criarColuna = useCallback(
    async (titulo) => {
      setSalvando(true);
      try {
        const resposta = await api.post(`${base}/colunas`, { nome: titulo });
        setColunas((prev) => [...prev, normalizarColuna(resposta.data)]);
        showToast("Coluna criada com sucesso.", "sucesso");
        return true;
      } catch (erro) {
        console.error(erro);
        showToast(erro.response?.data?.erro || "Erro ao criar coluna.", "erro");
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [base, setColunas, showToast]
  );

  const renomearColuna = useCallback(
    async (id, titulo) => {
      // Otimista: atualiza a tela antes da confirmação do servidor.
      const anterior = colunas;
      setColunas((prev) => prev.map((c) => (c.id === id ? { ...c, titulo, nome: titulo } : c)));
      setSalvando(true);
      try {
        await api.patch(`${base}/colunas/${id}`, { nome: titulo });
        showToast("Coluna renomeada com sucesso.", "sucesso");
        return true;
      } catch (erro) {
        console.error(erro);
        setColunas(anterior); // desfaz se der erro
        showToast(erro.response?.data?.erro || "Erro ao renomear coluna.", "erro");
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [base, colunas, setColunas, showToast]
  );

  // Reordena as colunas do quadro (drag-and-drop da coluna inteira, com
  // os cards dentro — não confundir com moverCard, que move um card entre
  // colunas). Mesmo padrão otimista de moverCardNoEstado: recompacta a
  // `ordem` de TODAS as colunas localmente, na mesma sequência 0..n-1 que
  // o backend vai calcular, pra não ter ordem duplicada entre o solte do
  // mouse e a resposta do servidor.
  const moverColuna = useCallback(
    async (id, novaOrdem) => {
      const anterior = colunas;

      const idsOrdenados = [...colunas].sort((a, b) => a.ordem - b.ordem).map((c) => c.id);
      const idsSemMovida = idsOrdenados.filter((colunaId) => colunaId !== id);
      const indice = Math.max(0, Math.min(novaOrdem, idsSemMovida.length));
      idsSemMovida.splice(indice, 0, id);

      const novaOrdemPorId = new Map(idsSemMovida.map((colunaId, index) => [colunaId, index]));

      setColunas((prev) =>
        prev
          .map((c) => (novaOrdemPorId.has(c.id) ? { ...c, ordem: novaOrdemPorId.get(c.id) } : c))
          .sort((a, b) => a.ordem - b.ordem)
      );

      try {
        await api.patch(`${base}/colunas/${id}/mover`, { ordem: novaOrdem });
      } catch (erro) {
        console.error(erro);
        setColunas(anterior); // desfaz se der erro
        showToast(erro.response?.data?.erro || "Erro ao mover coluna.", "erro");
      }
    },
    [base, colunas, setColunas, showToast]
  );

  const excluirColuna = useCallback(
    async (id) => {
      // Otimista: some da tela na hora. Se der erro, recarrega tudo do zero
      // pra garantir consistência (caso raro, não precisa de rollback fino).
      const anterior = colunas;
      setColunas((prev) => prev.filter((c) => c.id !== id));
      setCards((prev) => prev.filter((c) => c.coluna_id !== id));
      setSalvando(true);
      try {
        await api.delete(`${base}/colunas/${id}`);
        showToast("Coluna excluída com sucesso.", "sucesso");
        return true;
      } catch (erro) {
        console.error(erro);
        setColunas(anterior);
        await carregar();
        showToast(erro.response?.data?.erro || "Erro ao excluir coluna.", "erro");
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [base, colunas, setColunas, setCards, carregar, showToast]
  );

  return { criarColuna, renomearColuna, moverColuna, excluirColuna, salvando };
}