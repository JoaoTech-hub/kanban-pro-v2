import { describe, test, expect, beforeEach, afterEach } from "vitest";
import api from "../services/api";

// api.js não expõe o interceptor como função isolada — ele é registrado
// diretamente em `api.interceptors.response.use(...)`. Sem axios-mock-adapter
// ou msw no projeto, a forma mais direta e coerente com o próprio código de
// invocar exatamente a mesma lógica que roda em produção é chamar o handler
// `rejected` registrado no InterceptorManager (api.interceptors.response
// .handlers[0].rejected), simulando o axios reportando um erro de resposta.
function dispararErroDeResposta(status, url = "/qualquer-rota", codigo) {
  const handler = api.interceptors.response.handlers[0];
  const erro = { response: { status, data: codigo ? { codigo } : {} }, config: { url } };
  return handler.rejected(erro);
}

describe("api.js — interceptor de resposta 401", () => {
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

  test("401 identificado como sessão inválida limpa os dados de autenticação", async () => {
    await expect(dispararErroDeResposta(401, "/organizations/org-1/projects", "SESSAO_INVALIDA"))
      .rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("nome")).toBeNull();
    expect(localStorage.getItem("organizationId")).toBeNull();
    expect(localStorage.getItem("emailVerified")).toBeNull();
  });

  test("401 identificado como sessão inválida redireciona para /", async () => {
    window.location.pathname = "/dashboard";

    await expect(dispararErroDeResposta(401, "/perfil", "SESSAO_INVALIDA")).rejects.toBeTruthy();

    expect(window.location.href).toBe("/");
  });

  test("401 de login ou senha incorreta sem código de sessão não limpa a sessão", async () => {
    await expect(dispararErroDeResposta(401, "/login")).rejects.toBeTruthy();
    await expect(dispararErroDeResposta(401, "/perfil/senha")).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(localStorage.getItem("nome")).toBe("João");
    expect(localStorage.getItem("organizationId")).toBe("org-1");
    expect(localStorage.getItem("emailVerified")).toBe("false");
  });

  test.each([
    ["convite inválido", "/convites/aceitar/token-invalido"],
    ["recuperação de senha inválida", "/redefinir-senha"],
    ["verificação de e-mail inválida", "/verificar-email"],
  ])("401 de %s sem código de sessão mantém o usuário autenticado", async (_fluxo, url) => {
    await expect(dispararErroDeResposta(401, url)).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(localStorage.getItem("nome")).toBe("João");
    expect(localStorage.getItem("organizationId")).toBe("org-1");
    expect(localStorage.getItem("emailVerified")).toBe("false");
    expect(window.location.href).toBe("");
  });

  test("401 de convite inválido durante uma sessão logada não encerra essa sessão", async () => {
    await expect(
      dispararErroDeResposta(401, "/convites/aceitar/token-expirado")
    ).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(window.location.href).toBe("");
  });

  test("logout com JWT revogado continua limpando a sessão via código de sessão inválida", async () => {
    await expect(dispararErroDeResposta(401, "/auth/logout", "SESSAO_INVALIDA"))
      .rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBeNull();
    expect(window.location.href).toBe("/");
  });

  test("erro que não é 401 não limpa a sessão", async () => {
    await expect(dispararErroDeResposta(500)).rejects.toBeTruthy();

    expect(localStorage.getItem("token")).toBe("tok-123");
    expect(localStorage.getItem("emailVerified")).toBe("false");
  });

  test("não altera nenhuma outra lógica: o erro original continua sendo propagado (rejeitado) para quem chamou", async () => {
    const erroOriginal = {
      response: { status: 401, data: { codigo: "SESSAO_INVALIDA" } },
      config: { url: "/perfil" },
    };
    const handler = api.interceptors.response.handlers[0];

    await expect(handler.rejected(erroOriginal)).rejects.toBe(erroOriginal);
  });
});
