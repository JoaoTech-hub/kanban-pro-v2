import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";

vi.mock("../services/api", () => ({
  default: { post: vi.fn() },
}));

import api from "../services/api";

// Segue o padrão de KanbanContext.test.jsx: um componente consumidor simples
// renderizado dentro do Provider real, sem mockar nada — o AuthContext não
// depende de api nem de outros contextos.
function Consumidor() {
  const { emailVerified, token, nome, organizationId, login, logout, marcarEmailVerificado } = useAuth();
  return (
    <div>
      <span data-testid="emailVerified">{String(emailVerified)}</span>
      <span data-testid="token">{String(token)}</span>
      <span data-testid="nome">{nome}</span>
      <span data-testid="organizationId">{organizationId}</span>
      <button onClick={() => login("tok-1", "João", "org-1", { redirecionar: false, emailVerified: false })}>
        login-nao-verificado
      </button>
      <button onClick={() => login("tok-2", "João", "org-1", { redirecionar: false, emailVerified: true })}>
        login-verificado
      </button>
      <button onClick={() => login("tok-3", "João", "org-1", { redirecionar: false })}>
        login-sem-emailVerified
      </button>
      <button onClick={marcarEmailVerificado}>marcar-email-verificado</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderArvore() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Consumidor />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthContext — emailVerified (Fase 8.1)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    api.post.mockResolvedValue({});
  });

  test("sem sessão prévia no localStorage, assume emailVerified true por padrão", () => {
    renderArvore();
    expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
  });

  test("login() com emailVerified: false atualiza o contexto e persiste no localStorage", () => {
    renderArvore();

    act(() => {
      screen.getByText("login-nao-verificado").click();
    });

    expect(screen.getByTestId("emailVerified")).toHaveTextContent("false");
    expect(screen.getByTestId("token")).toHaveTextContent("tok-1");
    expect(localStorage.getItem("emailVerified")).toBe("false");
  });

  test("login() com emailVerified: true atualiza o contexto e persiste no localStorage", () => {
    renderArvore();

    act(() => {
      screen.getByText("login-verificado").click();
    });

    expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
    expect(localStorage.getItem("emailVerified")).toBe("true");
  });

  test("[regressão] login() sem informar emailVerified (chamadores antigos, ex.: convite) preserva token/nome/organizationId e trata como verificado", () => {
    renderArvore();

    act(() => {
      screen.getByText("login-sem-emailVerified").click();
    });

    expect(screen.getByTestId("token")).toHaveTextContent("tok-3");
    expect(screen.getByTestId("nome")).toHaveTextContent("João");
    expect(screen.getByTestId("organizationId")).toHaveTextContent("org-1");
    expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
  });

  test("sessão existente no localStorage sem a chave emailVerified (usuário anterior à Fase 8.1) é tratada como verificada", () => {
    localStorage.setItem("token", "tok-antigo");
    localStorage.setItem("nome", "Usuário Antigo");
    localStorage.setItem("organizationId", "org-antiga");
    // Propositalmente sem localStorage.setItem("emailVerified", ...).

    renderArvore();

    expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
    expect(screen.getByTestId("token")).toHaveTextContent("tok-antigo");
  });

  test("[regressão] logout() limpa emailVerified junto com o restante da sessão", async () => {
    renderArvore();

    act(() => {
      screen.getByText("login-nao-verificado").click();
    });
    expect(screen.getByTestId("emailVerified")).toHaveTextContent("false");

    await act(async () => {
      screen.getByText("logout").click();
    });

    expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
    expect(screen.getByTestId("token")).toHaveTextContent("null");
    expect(localStorage.getItem("emailVerified")).toBeNull();
  });

  test("logout chama a API antes de remover o token e finaliza localmente em sucesso", async () => {
    renderArvore();
    act(() => screen.getByText("login-verificado").click());
    api.post.mockImplementation(async () => {
      expect(localStorage.getItem("token")).toBe("tok-2");
      return {};
    });

    await act(async () => screen.getByText("logout").click());

    expect(api.post).toHaveBeenCalledWith("/auth/logout");
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("token")).toHaveTextContent("null");
  });

  test("logout finaliza localmente quando a API falha", async () => {
    renderArvore();
    act(() => screen.getByText("login-verificado").click());
    api.post.mockRejectedValue(new Error("API indispon\u00edvel"));

    await act(async () => screen.getByText("logout").click());

    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("token")).toHaveTextContent("null");
  });

  test("logout finaliza localmente quando o JWT expirou ou j\u00e1 foi revogado (401)", async () => {
    renderArvore();
    act(() => screen.getByText("login-verificado").click());
    api.post.mockRejectedValue({ response: { status: 401 } });

    await act(async () => screen.getByText("logout").click());

    expect(api.post).toHaveBeenCalledWith("/auth/logout");
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("token")).toHaveTextContent("null");
  });

  describe("marcarEmailVerificado() (Fase 8.1 — Bloco 1)", () => {
    test("sincroniza emailVerified para true no contexto e no localStorage, sem novo login", () => {
      renderArvore();

      act(() => {
        screen.getByText("login-nao-verificado").click();
      });
      expect(screen.getByTestId("emailVerified")).toHaveTextContent("false");
      expect(screen.getByTestId("token")).toHaveTextContent("tok-1");

      act(() => {
        screen.getByText("marcar-email-verificado").click();
      });

      expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
      expect(localStorage.getItem("emailVerified")).toBe("true");
    });

    test("preserva token, nome e organizationId ao sincronizar (não gera novo JWT nem altera a sessão)", () => {
      renderArvore();

      act(() => {
        screen.getByText("login-nao-verificado").click();
      });

      act(() => {
        screen.getByText("marcar-email-verificado").click();
      });

      expect(screen.getByTestId("token")).toHaveTextContent("tok-1");
      expect(screen.getByTestId("nome")).toHaveTextContent("João");
      expect(screen.getByTestId("organizationId")).toHaveTextContent("org-1");
      expect(localStorage.getItem("token")).toBe("tok-1");
      expect(localStorage.getItem("organizationId")).toBe("org-1");
      expect(localStorage.getItem("nome")).toBe("João");
    });

    test("não desloga o usuário (token permanece presente)", () => {
      renderArvore();

      act(() => {
        screen.getByText("login-nao-verificado").click();
      });

      act(() => {
        screen.getByText("marcar-email-verificado").click();
      });

      expect(screen.getByTestId("token")).not.toHaveTextContent("null");
      expect(localStorage.getItem("token")).not.toBeNull();
    });

    test("chamado sem sessão prévia (usuário deslogado) não gera token/nome/organizationId espúrios", () => {
      renderArvore();

      act(() => {
        screen.getByText("marcar-email-verificado").click();
      });

      expect(screen.getByTestId("emailVerified")).toHaveTextContent("true");
      expect(screen.getByTestId("token")).toHaveTextContent("null");
      expect(localStorage.getItem("token")).toBeNull();
    });
  });
});
