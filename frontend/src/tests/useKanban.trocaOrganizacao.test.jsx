import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import api from "../services/api";
import { useKanban } from "../hooks/useKanban";

vi.mock("../services/api");

function mockQuadroDaContaPrincipal() {
  api.get.mockImplementation((url) => {
    if (url.includes("/colunas")) {
      return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
    }
    if (url.includes("/cards")) {
      return Promise.resolve({
        data: [{ id: "card-1", colunaId: "col-1", ordem: 0, titulo: "Card da conta principal" }],
      });
    }
    return Promise.resolve({ data: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useKanban — troca de organização/conta (sem flash do quadro anterior)", () => {
  test("ao mudar organizationId, colunas e cards da conta anterior são descartados imediatamente", async () => {
    mockQuadroDaContaPrincipal();

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-principal", projId: "proj-principal" } }
    );

    await act(async () => {
      await result.current.carregar();
    });
    expect(result.current.colunas).toHaveLength(1);
    expect(result.current.cards).toHaveLength(1);

    // Conta nova: organização diferente e ainda sem projeto (projectId nulo)
    // — carregar() nunca dispara nesse caso, então antes da correção o
    // quadro antigo ficava na memória indefinidamente.
    rerender({ orgId: "org-nova", projId: null });

    expect(result.current.colunas).toEqual([]);
    expect(result.current.cards).toEqual([]);
  });

  test("logout (organizationId vira nulo) também descarta o quadro em memória", async () => {
    mockQuadroDaContaPrincipal();

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-principal", projId: "proj-principal" } }
    );

    await act(async () => {
      await result.current.carregar();
    });
    expect(result.current.cards).toHaveLength(1);

    rerender({ orgId: null, projId: null });

    expect(result.current.colunas).toEqual([]);
    expect(result.current.cards).toEqual([]);
  });

  test("re-render com a MESMA organização não descarta o quadro (sem regressão de refetch/flash na navegação)", async () => {
    mockQuadroDaContaPrincipal();

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-principal", projId: "proj-principal" } }
    );

    await act(async () => {
      await result.current.carregar();
    });

    rerender({ orgId: "org-principal", projId: "proj-principal" });

    expect(result.current.colunas).toHaveLength(1);
    expect(result.current.cards).toHaveLength(1);
  });
});