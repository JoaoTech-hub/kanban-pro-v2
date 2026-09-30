import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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
// Etapa 3 (frontend do Google Login): GoogleAuthButton é tratado como caixa
// preta aqui — este arquivo testa Login.jsx isoladamente (sem ThemeProvider
// do app nem GoogleOAuthProvider por perto), e o próprio componente real já
// tem cobertura dedicada. Sem esse mock, o teste ficaria acoplado a
// VITE_GOOGLE_CLIENT_ID estar vazio no ambiente de teste.
vi.mock("../components/GoogleAuthButton", () => ({
  default: () => null,
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

// <Navigate> (redirecionamento declarativo) usa a própria referência interna
// de useNavigate do react-router, que não passa pelo vi.mock acima — esse
// mock só troca o que a PÁGINA importa diretamente. Pra observar um
// redirecionamento de <Navigate>, precisamos de rotas de verdade e checar
// o que fica renderizado, em vez de checar se mockNavigate foi chamado
// (mesma estratégia já usada em ConfirmeSeuEmail.test.jsx, Fase 8.1).
function renderPaginaComRotas(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider theme={lightTheme}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<div>Página do Dashboard</div>} />
        </Routes>
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

  test("[novo] usuário já autenticado (sessão sobrevivente no localStorage) é redirecionado para /dashboard sem mostrar o formulário", () => {
    useAuth.mockReturnValue({ login, trocarOrganizacao, autenticado: true });

    renderPaginaComRotas();

    expect(screen.getByText("Página do Dashboard")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("E-mail")).not.toBeInTheDocument();
  });

  test("[novo] usuário já autenticado COM conviteToken não é redirecionado — pode logar como outra conta pra aceitar o convite", () => {
    useAuth.mockReturnValue({ login, trocarOrganizacao, autenticado: true });

    renderPaginaComRotas([{ pathname: "/", state: { conviteToken: "token-convite-123" } }]);

    expect(screen.queryByText("Página do Dashboard")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
  });

  test("[regressão] links 'Esqueci minha senha' e 'Criar conta' continuam navegando corretamente", () => {
    renderPagina();

    fireEvent.click(screen.getByText("Esqueci minha senha"));
    expect(mockNavigate).toHaveBeenCalledWith("/esqueci-senha");

    fireEvent.click(screen.getByText("Criar conta"));
    expect(mockNavigate).toHaveBeenCalledWith("/registro");
  });
});