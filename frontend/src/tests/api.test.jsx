import { describe, test, expect, beforeEach, afterEach } from "vitest";
import api from "../services/api";

// api.js não expõe o interceptor como função isolada — ele é registrado
// diretamente em `api.interceptors.response.use(...)`. Sem axios-mock-adapter
// ou msw no projeto, a forma mais direta e coerente com o próprio código de
// invocar exatamente a mesma lógica que roda em produção é chamar o handler
// `rejected` registrado no InterceptorManager (api.interceptors.response
// .handlers[0].rejected), simulando o axios reportando um erro de resposta.
function dispararErroDeResposta(status, url = "/qualquer-rota") {
  const handler = api.interceptors.response.handlers[0];
  const erro = { response: { status }, config: { url } };
  return handler.rejected(erro);
}

describe("api.js — interceptor de resposta 401 (Fase 8.1 — Bloco 3)", () => {
  let originalLocation;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "tok-123");
    localStorage.setItem("nome", "João");
    localStorage.setItem("organizationId", "org-1");
    localStorage.setItem("emailVerified", "false");

    // jsdom não implementa navegação real (window.location.href = ... lança
    // "Not implemented"), então substituímos location por um stub simples
    // só para observar a atribuição, restaurando ao final de cada teste.
    originalLocation = window.location;
    delete window.location;
    window.location = { pathname: "/dashboard", href: "" };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  test("401 em rota não esperada limpa token, nome, organizationId e emailVerified do localStorage", async () => {
    await expect(dispararErroDeResposta(401)).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("nome")).toBeNull();
    expect(localStorage.getItem("organizationId")).toBeNull();
    expect(localStorage.getItem("emailVerified")).toBeNull();
  });

  test("401 em rota não esperada redireciona para / quando não está lá", async () => {
    window.location.pathname = "/dashboard";

    await expect(dispararErroDeResposta(401)).rejects.toBeTruthy();

    expect(window.location.href).toBe("/");
  });

  test("401 em rota com 401 esperado (ex.: /login) não limpa a sessão", async () => {
    await expect(dispararErroDeResposta(401, "/login")).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(localStorage.getItem("nome")).toBe("João");
    expect(localStorage.getItem("organizationId")).toBe("org-1");
    expect(localStorage.getItem("emailVerified")).toBe("false");
  });

  test("erro que não é 401 não limpa a sessão", async () => {
    await expect(dispararErroDeResposta(500)).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(localStorage.getItem("emailVerified")).toBe("false");
  });

  test("não altera nenhuma outra lógica: o erro original continua sendo propagado (rejeitado) para quem chamou", async () => {
    const erroOriginal = { response: { status: 401 }, config: { url: "/perfil" } };
    const handler = api.interceptors.response.handlers[0];

    await expect(handler.rejected(erroOriginal)).rejects.toBe(erroOriginal);
  });
});