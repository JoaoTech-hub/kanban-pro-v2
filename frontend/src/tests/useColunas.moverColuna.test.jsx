import { describe, test, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { renderHook, act } from "@testing-library/react";
import { useColunas } from "../hooks/useColunas";
import { ToastProvider } from "../context/ToastContext";
import api from "../services/api";

// A chamada real de API não deve rodar em teste de hook — controlamos
// exatamente o que cada teste retorna (mesmo padrão de useProjetos.test.jsx).
vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const ORG_ID = "org-1";
const PROJECT_ID = "proj-1";

// useColunas usa useToast() internamente (feedback de erro), então todo
// renderHook precisa estar dentro de um ToastProvider real.
function wrapper({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// useColunas não gerencia o próprio estado de `colunas` — quem chama (o
// KanbanContext, na aplicação real) é quem guarda o estado e repassa via
// props. Esse harness reproduz exatamente esse contrato pra testar o hook
// isoladamente, do mesmo jeito que ele é usado de verdade.
function useColunasComEstado(colunasIniciais, carregar = vi.fn()) {
  const [colunas, setColunas] = useState(colunasIniciais);
  const [cards, setCards] = useState([]);
  const resultado = useColunas(ORG_ID, PROJECT_ID, { colunas, setColunas, setCards, carregar });
  return { colunas, cards, ...resultado };
}

const COLUNAS_INICIAIS = () => [
  { id: "col-a", titulo: "A Fazer", nome: "A Fazer", ordem: 0 },
  { id: "col-b", titulo: "Em Andamento", nome: "Em Andamento", ordem: 1 },
  { id: "col-c", titulo: "Concluído", nome: "Concluído", ordem: 2 },
];

function idsOrdenados(colunas) {
  return [...colunas].sort((a, b) => a.ordem - b.ordem).map((c) => c.id);
}

describe("useColunas — moverColuna (reordenar colunas do quadro)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("move a última coluna para o início e recompacta a ordem de todas", async () => {
    api.patch.mockResolvedValueOnce({});
    const { result } = renderHook(() => useColunasComEstado(COLUNAS_INICIAIS()), { wrapper });

    await act(async () => {
      await result.current.moverColuna("col-c", 0);
    });

    expect(idsOrdenados(result.current.colunas)).toEqual(["col-c", "col-a", "col-b"]);
    expect(result.current.colunas.map((c) => c.ordem).sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(api.patch).toHaveBeenCalledWith(
      `/organizations/${ORG_ID}/projects/${PROJECT_ID}/colunas/col-c/mover`,
      { ordem: 0 }
    );
  });

  test("move a primeira coluna para o meio e recompacta a ordem de todas", async () => {
    api.patch.mockResolvedValueOnce({});
    const { result } = renderHook(() => useColunasComEstado(COLUNAS_INICIAIS()), { wrapper });

    await act(async () => {
      await result.current.moverColuna("col-a", 1);
    });

    expect(idsOrdenados(result.current.colunas)).toEqual(["col-b", "col-a", "col-c"]);
  });

  test("mover para a posição já ocupada não altera a ordem relativa", async () => {
    api.patch.mockResolvedValueOnce({});
    const { result } = renderHook(() => useColunasComEstado(COLUNAS_INICIAIS()), { wrapper });

    await act(async () => {
      await result.current.moverColuna("col-b", 1);
    });

    expect(idsOrdenados(result.current.colunas)).toEqual(["col-a", "col-b", "col-c"]);
  });

  test("clampa localmente uma ordem além do tamanho da lista pro final", async () => {
    api.patch.mockResolvedValueOnce({});
    const { result } = renderHook(() => useColunasComEstado(COLUNAS_INICIAIS()), { wrapper });

    await act(async () => {
      await result.current.moverColuna("col-a", 999);
    });

    expect(idsOrdenados(result.current.colunas)).toEqual(["col-b", "col-c", "col-a"]);
  });

  test("em caso de falha da API, desfaz a reordenação otimista (rollback completo)", async () => {
    api.patch.mockRejectedValueOnce({ response: { data: { erro: "Erro ao mover coluna." } } });
    const { result } = renderHook(() => useColunasComEstado(COLUNAS_INICIAIS()), { wrapper });

    await act(async () => {
      await result.current.moverColuna("col-c", 0);
    });

    // Depois do rollback, a ordem volta a ser exatamente a original.
    expect(idsOrdenados(result.current.colunas)).toEqual(["col-a", "col-b", "col-c"]);
    expect(result.current.colunas.find((c) => c.id === "col-a").ordem).toBe(0);
    expect(result.current.colunas.find((c) => c.id === "col-b").ordem).toBe(1);
    expect(result.current.colunas.find((c) => c.id === "col-c").ordem).toBe(2);
  });

  test("não chama carregar() (recarga completa) no caminho de sucesso — só o rollback local", async () => {
    api.patch.mockResolvedValueOnce({});
    const carregar = vi.fn();
    const { result } = renderHook(() => useColunasComEstado(COLUNAS_INICIAIS(), carregar), {
      wrapper,
    });

    await act(async () => {
      await result.current.moverColuna("col-a", 2);
    });

    expect(carregar).not.toHaveBeenCalled();
  });
});