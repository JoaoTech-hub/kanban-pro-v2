const { PLAN_LIMITS, limiteMembros, limiteProjetos } = require("../src/shared/planLimits");

describe("shared/planLimits — fonte única de verdade dos limites por plano", () => {
  test("Free: 10 membros e 10 projetos", () => {
    expect(limiteMembros("free")).toBe(10);
    expect(limiteProjetos("free")).toBe(10);
  });

  test("Pro: sem teto (Infinity) para membros e projetos", () => {
    expect(limiteMembros("pro")).toBe(Infinity);
    expect(limiteProjetos("pro")).toBe(Infinity);
    expect(Number.isFinite(limiteMembros("pro"))).toBe(false);
    expect(Number.isFinite(limiteProjetos("pro"))).toBe(false);
  });

  test("plano desconhecido cai nos limites do Free, em vez de ficar sem limite algum", () => {
    expect(limiteMembros("plano-que-nao-existe")).toBe(PLAN_LIMITS.free.maxMembers);
    expect(limiteProjetos(undefined)).toBe(PLAN_LIMITS.free.maxProjects);
  });

  test("PLAN_LIMITS é a única fonte consultada — mudar aqui muda o comportamento das duas funções", () => {
    // Não testamos números mágicos duplicados: comparamos direto contra o
    // objeto de configuração, pra este teste continuar válido mesmo se o
    // valor numérico do Free mudar de novo no futuro.
    expect(limiteMembros("free")).toBe(PLAN_LIMITS.free.maxMembers);
    expect(limiteProjetos("free")).toBe(PLAN_LIMITS.free.maxProjects);
  });
});