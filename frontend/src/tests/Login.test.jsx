import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import Login from "../pages/Login";
import { lightTheme } from "../styles/theme";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";

// Teste de componente isolado — mesma estratégia de HeaderMenu.test.jsx:
// mocka diretamente os contextos/hooks que Login.jsx consome (useAuth,
// useToast, useOrganizacoes) em vez de montar a árvore de Providers inteira.
vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../context/ToastContext", () => ({
  useToast: vi.fn(),
}));
vi.mock("../hooks/useOrganizacoes", () => ({
  useOrganizacoes: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, useNavigate: () => mockNavigate };
});

function renderPagina(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider theme={lightTheme}>
        <Login />
      </ThemeProvider>
    </MemoryRouter>
  );
}

function preencherFormulario({ email = "joao@teste.com", senha = "senha123" } = {}) {
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: senha } });
}

describe("Login — integração com emailVerified (Fase 8.1)", () => {
  let login, trocarOrganizacao, showToast, carregar;

  beforeEach(() => {
    api.post.mockReset();
    mockNavigate.mockReset();
    login = vi.fn();
    trocarOrganizacao = vi.fn();
    showToast = vi.fn();
    carregar = vi.fn();

    useAuth.mockReturnValue({ login, trocarOrganizacao });
    useToast.mockReturnValue({ showToast });
    useOrganizacoes.mockReturnValue({ carregar });
  });

  test("login com emailVerified: false NÃO trata o usuário como verificado — encaminha para /confirme-seu-email", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        token: "token-nao-verificado",
        nome: "João Vitor",
        organizationId: "org-1",
        emailVerified: false,
      },
    });

    renderPagina();
    preencherFormulario();
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/login", {
        email: "joao@teste.com",
        senha: "senha123",
      });
    });

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("token-nao-verificado", "João Vitor", "org-1", {
        redirecionar: false,
        emailVerified: false,
      });
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/confirme-seu-email");
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
  });

  test("login de usuário verificado (emailVerified: true) continua funcionando normalmente [regressão]", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        token: "token-verificado",
        nome: "João Vitor",
        organizationId: "org-1",
        emailVerified: true,
      },
    });

    renderPagina();
    preencherFormulario();
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("token-verificado", "João Vitor", "org-1", {
        redirecionar: false,
        emailVerified: true,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  test("[regressão] credenciais inválidas exibem mensagem de erro, não chamam login() nem navegam", async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401 } });

    renderPagina();
    preencherFormulario({ senha: "senhaErrada" });
    fireEvent.click(screen.getByText("Entrar"));

    expect(await screen.findByText("E-mail ou senha inválidos.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("[regressão] fluxo de aceite de convite continua indo para /dashboard mesmo com emailVerified: false", async () => {
    api.post.mockImplementation((url) => {
      if (url === "/login") {
        return Promise.resolve({
          data: {
            token: "token-convite",
            nome: "João Vitor",
            organizationId: "org-antiga",
            emailVerified: false,
          },
        });
      }
      if (url === "/convites/token-convite-123/aceitar-existente") {
        return Promise.resolve({ data: { organizationId: "org-nova" } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    renderPagina([{ pathname: "/", state: { conviteToken: "token-convite-123" } }]);
    preencherFormulario();
    fireEvent.click(screen.getByText("Entrar"));

    // O AuthContext passa a saber que o e-mail não está verificado...
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("token-convite", "João Vitor", "org-antiga", {
        redirecionar: false,
        emailVerified: false,
      });
    });
    // ...mas o fluxo de convite em si foi preservado: continua indo direto
    // para o dashboard, sem passar por /confirme-seu-email.
    await waitFor(() => {
      expect(trocarOrganizacao).toHaveBeenCalledWith("org-nova");
    });
    expect(carregar).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Convite aceito com sucesso!", "sucesso");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    expect(mockNavigate).not.toHaveBeenCalledWith("/confirme-seu-email");
  });

  test("[regressão] links 'Esqueci minha senha' e 'Criar conta' continuam navegando corretamente", () => {
    renderPagina();

    fireEvent.click(screen.getByText("Esqueci minha senha"));
    expect(mockNavigate).toHaveBeenCalledWith("/esqueci-senha");

    fireEvent.click(screen.getByText("Criar conta"));
    expect(mockNavigate).toHaveBeenCalledWith("/registro");
  });
});