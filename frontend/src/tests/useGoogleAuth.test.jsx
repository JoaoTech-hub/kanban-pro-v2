import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import api from "../services/api";

// A chamada real de API não deve rodar em teste de hook — controlamos
// exatamente o que cada teste retorna.
vi.mock("../services/api", () => ({
  default: { post: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, useNavigate: () => mockNavigate };
});

// useGoogleAuth usa useAuth() (login real, pra checar que o AuthContext é
// mesmo sincronizado) e useToast() (feedback de erro) — árvore real de
// providers, mesmo padrão de useEquipe.test.jsx.
function wrapper({ children }) {
  return (
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function renderizarHookComposto() {
  return renderHook(
    () => ({ google: useGoogleAuth(), auth: useAuth() }),
    { wrapper }
  );
}

describe("useGoogleAuth (Etapa 3 — frontend do Google Login)", () => {
  beforeEach(() => {
    api.post.mockReset();
    mockNavigate.mockReset();
    localStorage.clear();
  });

  test("entrarComGoogle chama POST /auth/google com o idToken recebido", async () => {
    api.post.mockResolvedValueOnce({
      data: { token: "tok", nome: "João", organizationId: "org-1", emailVerified: true },
    });
    const { result } = renderizarHookComposto();

    await act(async () => {
      await result.current.google.entrarComGoogle("credential-do-google");
    });

    expect(api.post).toHaveBeenCalledWith("/auth/google", { idToken: "credential-do-google" });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test("emailVerified: true sincroniza o AuthContext (mesmo mecanismo do login tradicional) e navega para /dashboard", async () => {
    api.post.mockResolvedValueOnce({
      data: { token: "tok-1", nome: "João", organizationId: "org-1", emailVerified: true },
    });
    const { result } = renderizarHookComposto();

    await act(async () => {
      await result.current.google.entrarComGoogle("credential-1");
    });

    expect(result.current.auth.token).toBe("tok-1");
    expect(result.current.auth.organizationId).toBe("org-1");
    expect(result.current.auth.emailVerified).toBe(true);
    expect(localStorage.getItem("token")).toBe("tok-1");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test("emailVerified: false sincroniza o AuthContext e navega para /confirme-seu-email (mesma regra da Fase 8.1)", async () => {
    api.post.mockResolvedValueOnce({
      data: { token: "tok-2", nome: "Maria", organizationId: "org-2", emailVerified: false },
    });
    const { result } = renderizarHookComposto();

    await act(async () => {
      await result.current.google.entrarComGoogle("credential-2");
    });

    expect(result.current.auth.emailVerified).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/confirme-seu-email");
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
  });

  test("executa o callback de convite após autenticar e deixa a navegação sob controle do fluxo", async () => {
    const dadosLogin = {
      token: "tok-convite",
      nome: "João",
      organizationId: "org-atual",
      emailVerified: true,
    };
    const aoAutenticar = vi.fn().mockResolvedValue(undefined);
    api.post.mockResolvedValueOnce({ data: dadosLogin });
    const { result } = renderizarHookComposto();

    await act(async () => {
      await result.current.google.entrarComGoogle("credential-convite", aoAutenticar);
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/auth/google", { idToken: "credential-convite" });
    expect(result.current.auth.token).toBe("tok-convite");
    expect(aoAutenticar).toHaveBeenCalledWith(dadosLogin);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("tratarErroGoogle exibe a mensagem de erro vinda do backend", async () => {
    const { result } = renderizarHookComposto();

    act(() => {
      result.current.google.tratarErroGoogle({
        response: { data: { erro: "E-mail não verificado pelo Google" } },
      });
    });

    expect(await screen.findByText("E-mail não verificado pelo Google")).toBeInTheDocument();
  });

  test("tratarErroGoogle usa mensagem padrão quando não há resposta do backend (ex.: erro do próprio Google)", async () => {
    const { result } = renderizarHookComposto();

    act(() => {
      result.current.google.tratarErroGoogle();
    });

    expect(
      await screen.findByText("Não foi possível continuar com o Google. Tente novamente.")
    ).toBeInTheDocument();
  });
});
