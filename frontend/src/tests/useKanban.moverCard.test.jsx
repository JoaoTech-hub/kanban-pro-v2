import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import api from "../services/api";
import { useKanban } from "../hooks/useKanban";

vi.mock("../services/api");

const ORG_ID = "org-1";
const PROJECT_ID = "proj-1";

function cardApi(id, colunaId, ordem) {
  return { id, colunaId, ordem, titulo: `Card ${id}` };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useKanban — moverCard (estado otimista + rollback)", () => {
  test("aplica a recompactação otimista imediatamente, antes da resposta da API", async () => {
    api.get.mockImplementation((url) => {
      if (url.includes("/colunas")) {
        return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
      }
      if (url.includes("/cards")) {
        return Promise.resolve({
          data: [cardApi("a", "col-1", 0), cardApi("b", "col-1", 1), cardApi("c", "col-1", 2)],
        });
      }
      return Promise.resolve({ data: [] });
    });

    // A requisição de mover nunca resolve durante o teste — dá pra checar
    // o estado otimista antes de qualquer resposta chegar.
    let resolverPatch;
    api.patch.mockReturnValue(new Promise((r) => { resolverPatch = r; }));

    const { result } = renderHook(() => useKanban(ORG_ID, PROJECT_ID));

    await act(async () => {
      await result.current.carregar();
    });

    act(() => {
      result.current.moverCard("c", "col-1", 0);
    });

    const porId = Object.fromEntries(result.current.cards.map((c) => [c.id, c.ordem]));
    expect(porId).toEqual({ a: 1, b: 2, c: 0 });

    resolverPatch({});
  });

  test("envia o payload esperado pra API (colunaId, ordem)", async () => {
    api.get.mockImplementation((url) => {
      if (url.includes("/colunas")) return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
      if (url.includes("/cards")) {
        return Promise.resolve({ data: [cardApi("a", "col-1", 0), cardApi("b", "col-1", 1)] });
      }
      return Promise.resolve({ data: [] });
    });
    api.patch.mockResolvedValue({});

    const { result } = renderHook(() => useKanban(ORG_ID, PROJECT_ID));

    await act(async () => {
      await result.current.carregar();
    });

    await act(async () => {
      await result.current.moverCard("a", "col-1", 1);
    });

    expect(api.patch).toHaveBeenCalledWith(
      `/organizations/${ORG_ID}/projects/${PROJECT_ID}/cards/a/mover`,
      { colunaId: "col-1", ordem: 1 }
    );
  });

  test("nunca deixa `ordem` duplicada no estado local após o otimista, mesmo movendo entre colunas", async () => {
    api.get.mockImplementation((url) => {
      if (url.includes("/colunas")) {
        return Promise.resolve({
          data: [{ id: "col-1", nome: "A Fazer" }, { id: "col-2", nome: "Feito" }],
        });
      }
      if (url.includes("/cards")) {
        return Promise.resolve({
          data: [cardApi("a", "col-1", 0), cardApi("b", "col-1", 1), cardApi("x", "col-2", 0)],
        });
      }
      return Promise.resolve({ data: [] });
    });
    api.patch.mockReturnValue(new Promise(() => {})); // nunca resolve nesse teste

    const { result } = renderHook(() => useKanban(ORG_ID, PROJECT_ID));

    await act(async () => {
      await result.current.carregar();
    });

    act(() => {
      result.current.moverCard("a", "col-2", 0);
    });

    for (const colunaId of ["col-1", "col-2"]) {
      const ordens = result.current.cards
        .filter((c) => c.coluna_id === colunaId)
        .map((c) => c.ordem);
      expect(new Set(ordens).size).toBe(ordens.length);
    }
  });

  test("em caso de falha na movimentação, descarta o otimista e recarrega do backend (mesmo mecanismo de rollback já existente)", async () => {
    let cardsNoServidor = [cardApi("a", "col-1", 0), cardApi("b", "col-1", 1)];

    api.get.mockImplementation((url) => {
      if (url.includes("/colunas")) return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
      if (url.includes("/cards")) return Promise.resolve({ data: cardsNoServidor });
      return Promise.resolve({ data: [] });
    });
    api.patch.mockRejectedValue(new Error("falha de rede"));

    const { result } = renderHook(() => useKanban(ORG_ID, PROJECT_ID));

    await act(async () => {
      await result.current.carregar();
    });

    await act(async () => {
      // moverCard só resolve depois do catch já ter chamado carregar() de
      // novo — como o servidor "real" não mudou, o estado final deve ser
      // exatamente igual ao que veio da última busca (sem sobra do otimista).
      await result.current.moverCard("a", "col-1", 1);
    });

    await waitFor(() => {
      const porId = Object.fromEntries(result.current.cards.map((c) => [c.id, c.ordem]));
      expect(porId).toEqual({ a: 0, b: 1 });
    });

    // carregar() foi chamado uma vez no mount + uma vez no catch do erro.
    const chamadasCards = api.get.mock.calls.filter(([url]) => url.includes("/cards"));
    expect(chamadasCards.length).toBe(2);
  });
});