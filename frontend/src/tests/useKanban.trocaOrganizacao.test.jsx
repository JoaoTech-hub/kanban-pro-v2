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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function respostaQuadro(contexto) {
  return {
    colunas: { data: [{ id: `col-${contexto}`, nome: `Coluna ${contexto}` }] },
    cards: {
      data: [{ id: `card-${contexto}`, colunaId: `col-${contexto}`, ordem: 0, titulo: `Card ${contexto}` }],
    },
  };
}

function requisicoesPendentes(contexto) {
  return { colunas: deferred(), cards: deferred(), resposta: respostaQuadro(contexto) };
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

  test("descarta respostas antigas da organização A quando B termina primeiro", async () => {
    const requisicoesA = requisicoesPendentes("A");
    const quadroB = respostaQuadro("B");
    api.get.mockImplementation((url) => {
      if (url.includes("org-A")) {
        return url.includes("/colunas") ? requisicoesA.colunas.promise : requisicoesA.cards.promise;
      }
      return Promise.resolve(url.includes("/colunas") ? quadroB.colunas : quadroB.cards);
    });

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-A", projId: "proj-A" } }
    );

    let cargaA;
    act(() => {
      cargaA = result.current.carregar();
    });

    rerender({ orgId: "org-B", projId: "proj-B" });
    await act(async () => {
      await result.current.carregar();
    });
    expect(result.current.cards.map(({ id }) => id)).toEqual(["card-B"]);
    expect(result.current.colunas.map(({ id }) => id)).toEqual(["col-B"]);

    await act(async () => {
      requisicoesA.colunas.resolve(requisicoesA.resposta.colunas);
      requisicoesA.cards.resolve(requisicoesA.resposta.cards);
      await cargaA;
    });

    expect(result.current.cards.map(({ id }) => id)).toEqual(["card-B"]);
    expect(result.current.colunas.map(({ id }) => id)).toEqual(["col-B"]);
    expect(result.current.erro).toBeNull();
    expect(result.current.carregando).toBe(false);
  });

  test("erro de uma carga antiga não substitui os dados nem o erro do contexto atual", async () => {
    const requisicoesA = requisicoesPendentes("A");
    const quadroB = respostaQuadro("B");
    api.get.mockImplementation((url) => {
      if (url.includes("org-A")) {
        return url.includes("/colunas") ? requisicoesA.colunas.promise : requisicoesA.cards.promise;
      }
      return Promise.resolve(url.includes("/colunas") ? quadroB.colunas : quadroB.cards);
    });
    const erroConsole = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-A", projId: "proj-A" } }
    );
    let cargaA;
    act(() => {
      cargaA = result.current.carregar();
    });

    rerender({ orgId: "org-B", projId: "proj-B" });
    await act(async () => {
      await result.current.carregar();
    });
    await act(async () => {
      requisicoesA.cards.reject(new Error("resposta antiga falhou"));
      await cargaA;
      requisicoesA.colunas.resolve(requisicoesA.resposta.colunas);
    });

    expect(result.current.cards.map(({ id }) => id)).toEqual(["card-B"]);
    expect(result.current.colunas.map(({ id }) => id)).toEqual(["col-B"]);
    expect(result.current.erro).toBeNull();
    expect(result.current.carregando).toBe(false);
    expect(erroConsole).not.toHaveBeenCalled();
    erroConsole.mockRestore();
  });

  test("em A → B → C, somente a resposta mais recente de C pode atualizar o estado", async () => {
    const requisicoes = {
      A: requisicoesPendentes("A"),
      B: requisicoesPendentes("B"),
      C: requisicoesPendentes("C"),
    };
    api.get.mockImplementation((url) => {
      const contexto = url.includes("org-A") ? "A" : url.includes("org-B") ? "B" : "C";
      return url.includes("/colunas")
        ? requisicoes[contexto].colunas.promise
        : requisicoes[contexto].cards.promise;
    });

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-A", projId: "proj-A" } }
    );
    let cargaA;
    act(() => {
      cargaA = result.current.carregar();
    });

    rerender({ orgId: "org-B", projId: "proj-B" });
    let cargaB;
    act(() => {
      cargaB = result.current.carregar();
    });
    rerender({ orgId: "org-C", projId: "proj-C" });
    let cargaC;
    act(() => {
      cargaC = result.current.carregar();
    });

    await act(async () => {
      requisicoes.C.colunas.resolve(requisicoes.C.resposta.colunas);
      requisicoes.C.cards.resolve(requisicoes.C.resposta.cards);
      await cargaC;
    });
    await act(async () => {
      requisicoes.B.colunas.resolve(requisicoes.B.resposta.colunas);
      requisicoes.B.cards.resolve(requisicoes.B.resposta.cards);
      await cargaB;
      requisicoes.A.colunas.resolve(requisicoes.A.resposta.colunas);
      requisicoes.A.cards.resolve(requisicoes.A.resposta.cards);
      await cargaA;
    });

    expect(result.current.cards.map(({ id }) => id)).toEqual(["card-C"]);
    expect(result.current.colunas.map(({ id }) => id)).toEqual(["col-C"]);
    expect(result.current.erro).toBeNull();
    expect(result.current.carregando).toBe(false);
  });

  test("ao trocar de projeto na mesma organização, limpa o quadro e ignora respostas do projeto anterior", async () => {
    const requisicoesA = requisicoesPendentes("projeto-A");
    const quadroB = respostaQuadro("projeto-B");
    api.get.mockImplementation((url) => {
      if (url.includes("proj-A")) {
        return url.includes("/colunas") ? requisicoesA.colunas.promise : requisicoesA.cards.promise;
      }
      return Promise.resolve(url.includes("/colunas") ? quadroB.colunas : quadroB.cards);
    });

    const { result, rerender } = renderHook(
      ({ orgId, projId }) => useKanban(orgId, projId),
      { initialProps: { orgId: "org-A", projId: "proj-A" } }
    );
    let cargaA;
    act(() => {
      cargaA = result.current.carregar();
    });

    rerender({ orgId: "org-A", projId: "proj-B" });
    expect(result.current.cards).toEqual([]);
    expect(result.current.colunas).toEqual([]);

    await act(async () => {
      await result.current.carregar();
    });
    await act(async () => {
      requisicoesA.colunas.resolve(requisicoesA.resposta.colunas);
      requisicoesA.cards.resolve(requisicoesA.resposta.cards);
      await cargaA;
    });

    expect(result.current.cards.map(({ id }) => id)).toEqual(["card-projeto-B"]);
    expect(result.current.colunas.map(({ id }) => id)).toEqual(["col-projeto-B"]);
  });
});
