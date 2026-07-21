import { describe, test, expect } from "vitest";
import { formatarData, labelPrioridade, estaAtrasado } from "../utils/formatters";

describe("formatarData", () => {
  test("formata uma data ISO para dd/mm/aaaa", () => {
    expect(formatarData("2026-07-04")).toBe("04/07/2026");
  });

  test("retorna string vazia para valor ausente", () => {
    expect(formatarData(null)).toBe("");
    expect(formatarData(undefined)).toBe("");
    expect(formatarData("")).toBe("");
  });

  test("retorna a string original se não for uma data ISO válida", () => {
    expect(formatarData("texto sem formato de data")).toBe("texto sem formato de data");
  });
});

describe("labelPrioridade", () => {
  test("traduz os valores conhecidos", () => {
    expect(labelPrioridade("baixa")).toBe("Baixa");
    expect(labelPrioridade("media")).toBe("Média");
    expect(labelPrioridade("alta")).toBe("Alta");
  });

  test("retorna o valor original se for desconhecido", () => {
    expect(labelPrioridade("urgente")).toBe("urgente");
  });
});

describe("estaAtrasado", () => {
  test("retorna false quando não há prazo", () => {
    expect(estaAtrasado(null)).toBe(false);
    expect(estaAtrasado(undefined)).toBe(false);
  });

  test("retorna true para uma data no passado", () => {
    expect(estaAtrasado("2020-01-01")).toBe(true);
  });

  test("retorna false para uma data no futuro", () => {
    expect(estaAtrasado("2099-01-01")).toBe(false);
  });
});
