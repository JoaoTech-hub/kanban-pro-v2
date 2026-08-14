import { describe, test, expect } from "vitest";
import { moverCardNoEstado } from "../hooks/useKanban";

// Helper: cria um card mínimo pro teste, no formato já normalizado
// (coluna_id, não colunaId — ver normalizarCard em useKanban.js).
function card(id, coluna_id, ordem) {
  return { id, coluna_id, ordem, titulo: `Card ${id}` };
}

describe("moverCardNoEstado — recompactação otimista de `ordem` no frontend", () => {
  test("mover dentro da mesma coluna para o início desloca os demais corretamente", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1), card("c", "col-1", 2)];

    const resultado = moverCardNoEstado(cards, "c", "col-1", 0);
    const porId = Object.fromEntries(resultado.map((c) => [c.id, c.ordem]));

    expect(porId).toEqual({ a: 1, b: 2, c: 0 });
  });

  test("mover dentro da mesma coluna para o meio desloca os demais corretamente", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-1", 1),
      card("c", "col-1", 2),
      card("d", "col-1", 3),
    ];

    // Move "d" para o índice 1 (entre "a" e "b")
    const resultado = moverCardNoEstado(cards, "d", "col-1", 1);
    const porId = Object.fromEntries(resultado.map((c) => [c.id, c.ordem]));

    expect(porId).toEqual({ a: 0, d: 1, b: 2, c: 3 });
  });

  test("mover dentro da mesma coluna para o final desloca os demais corretamente", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1), card("c", "col-1", 2)];

    const resultado = moverCardNoEstado(cards, "a", "col-1", 2);
    const porId = Object.fromEntries(resultado.map((c) => [c.id, c.ordem]));

    expect(porId).toEqual({ b: 0, c: 1, a: 2 });
  });

  test("mover para outra coluna recompacta origem e destino, sem buracos", () => {
    const cards = [
      card("a", "col-1", 0),
      card("b", "col-1", 1),
      card("c", "col-1", 2),
      card("x", "col-2", 0),
      card("y", "col-2", 1),
    ];

    // Move "b" (col-1) para col-2, posição 1 (entre x e y)
    const resultado = moverCardNoEstado(cards, "b", "col-2", 1);
    const porId = Object.fromEntries(resultado.map((c) => [c.id, { coluna: c.coluna_id, ordem: c.ordem }]));

    expect(porId).toEqual({
      a: { coluna: "col-1", ordem: 0 },
      c: { coluna: "col-1", ordem: 1 },
      x: { coluna: "col-2", ordem: 0 },
      b: { coluna: "col-2", ordem: 1 },
      y: { coluna: "col-2", ordem: 2 },
    });
  });

  test("mover o único card de uma coluna para outra esvazia a origem sem buracos (coluna some do mapa, não fica com card fantasma)", () => {
    const cards = [card("a", "col-1", 0), card("x", "col-2", 0), card("y", "col-2", 1)];

    const resultado = moverCardNoEstado(cards, "a", "col-2", 0);
    const daColunaOrigem = resultado.filter((c) => c.coluna_id === "col-1");
    const daColunaDestino = resultado
      .filter((c) => c.coluna_id === "col-2")
      .sort((c1, c2) => c1.ordem - c2.ordem);

    expect(daColunaOrigem).toHaveLength(0);
    expect(daColunaDestino.map((c) => c.id)).toEqual(["a", "x", "y"]);
    expect(daColunaDestino.map((c) => c.ordem)).toEqual([0, 1, 2]);
  });

  test("mover para a mesma posição não introduz `ordem` duplicada nem corrompe a coluna", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1), card("c", "col-1", 2)];

    const resultado = moverCardNoEstado(cards, "b", "col-1", 1);
    const ordens = resultado.filter((c) => c.coluna_id === "col-1").map((c) => c.ordem);

    expect(new Set(ordens).size).toBe(ordens.length); // nenhuma duplicata
    expect(ordens.sort()).toEqual([0, 1, 2]);
  });

  test("nunca produz duas `ordem` iguais na mesma coluna após qualquer movimento (mesma coluna ou entre colunas)", () => {
    const cenarios = [
      { cards: [card("a", "col-1", 0), card("b", "col-1", 1), card("c", "col-1", 2)], mover: ["a", "col-1", 2] },
      {
        cards: [card("a", "col-1", 0), card("b", "col-1", 1), card("x", "col-2", 0)],
        mover: ["a", "col-2", 0],
      },
    ];

    for (const { cards, mover } of cenarios) {
      const resultado = moverCardNoEstado(cards, ...mover);
      const colunas = [...new Set(resultado.map((c) => c.coluna_id))];
      for (const colunaId of colunas) {
        const ordens = resultado.filter((c) => c.coluna_id === colunaId).map((c) => c.ordem);
        expect(new Set(ordens).size).toBe(ordens.length);
      }
    }
  });

  test("índice fora dos limites é clampado (não gera ordem negativa nem buraco)", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1)];

    const paraNegativo = moverCardNoEstado(cards, "a", "col-1", -5);
    expect(paraNegativo.find((c) => c.id === "a").ordem).toBe(0);

    const paraAlemDoFim = moverCardNoEstado(cards, "a", "col-1", 99);
    expect(paraAlemDoFim.find((c) => c.id === "a").ordem).toBe(1);
  });

  test("cards de outras colunas não são tocados", () => {
    const cards = [card("a", "col-1", 0), card("b", "col-1", 1), card("z", "col-3", 0)];

    const resultado = moverCardNoEstado(cards, "a", "col-1", 1);
    const z = resultado.find((c) => c.id === "z");

    expect(z).toEqual(cards.find((c) => c.id === "z"));
  });

  test("cardId inexistente retorna o array original sem alterações", () => {
    const cards = [card("a", "col-1", 0)];
    const resultado = moverCardNoEstado(cards, "nao-existe", "col-1", 0);

    expect(resultado).toBe(cards);
  });
});