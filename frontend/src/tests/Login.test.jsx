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

// Teste de componente isolado: contextos de Login são mocks; o botão Google
// usa o hook real para cobrir autenticação e o callback do convite sem SDK externo.
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
// O harness abaixo dispensa GoogleOAuthProvider e o SDK visual; a lógica de
// autenticação é exercida pelo useGoogleAuth real.
vi.mock("../components/GoogleAuthButton", async () => {
  const { useGoogleAuth } = await vi.importActual("../hooks/useGoogleAuth");
  return {
    default: ({ aoAutenticar }) => {
      const { entrarComGoogle, tratarErroGoogle } = useGoogleAuth();
      return (
        <button
          type="button"
          onClick={() => entrarComGoogle("credential-de-teste", aoAutenticar).catch(tratarErroGoogle)}
        >
          Continuar com Google
        </button>
      );
    },
  };
});

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

  test("aceite bem-sucedido seleciona a organização, recarrega a lista e navega ao dashboard", async () => {
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
    expect(api.post.mock.invocationCallOrder[1]).toBeLessThan(
      trocarOrganizacao.mock.invocationCallOrder[0]
    );
    expect(trocarOrganizacao.mock.invocationCallOrder[0]).toBeLessThan(
      carregar.mock.invocationCallOrder[0]
    );
    expect(carregar.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0]
    );
  });

  test("falha no aceite informa o erro e não seleciona a organização nem navega ao dashboard", async () => {
    api.post.mockImplementation((url) => {
      if (url === "/login") {
        return Promise.resolve({
          data: {
            token: "token-convite",
            nome: "João Vitor",
            organizationId: "org-antiga",
            emailVerified: true,
          },
        });
      }
      if (url === "/convites/token-convite-123/aceitar-existente") {
        return Promise.reject({ response: { data: { erro: "Este convite expirou." } } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    renderPagina([{ pathname: "/", state: { conviteToken: "token-convite-123" } }]);
    preencherFormulario();
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Este convite expirou.", "erro");
    });
    expect(login).toHaveBeenCalledWith("token-convite", "João Vitor", "org-antiga", {
      redirecionar: false,
      emailVerified: true,
    });
    expect(trocarOrganizacao).not.toHaveBeenCalled();
    expect(carregar).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalledWith("Convite aceito com sucesso!", "sucesso");
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
  });

  test("login iniciado por convite mostra Google e aceita usando o token preservado", async () => {
    api.post.mockImplementation((url) => {
      if (url === "/auth/google") {
        return Promise.resolve({
          data: {
            token: "token-google",
            nome: "João Vitor",
            organizationId: "org-atual",
            emailVerified: true,
          },
        });
      }
      if (url === "/convites/token-convite-google/aceitar-existente") {
        return Promise.resolve({ data: { organizationId: "org-convidante" } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    renderPagina([{ pathname: "/", state: { conviteToken: "token-convite-google" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/convites/token-convite-google/aceitar-existente"
      );
    });
    expect(api.post).toHaveBeenNthCalledWith(1, "/auth/google", {
      idToken: "credential-de-teste",
    });
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      "/convites/token-convite-google/aceitar-existente"
    );
    expect(login).toHaveBeenCalledWith("token-google", "João Vitor", "org-atual", {
      redirecionar: false,
      emailVerified: true,
    });
    expect(trocarOrganizacao).toHaveBeenCalledWith("org-convidante");
    expect(carregar).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Convite aceito com sucesso!", "sucesso");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    expect(api.post.mock.invocationCallOrder[1]).toBeLessThan(
      trocarOrganizacao.mock.invocationCallOrder[0]
    );
    expect(trocarOrganizacao.mock.invocationCallOrder[0]).toBeLessThan(
      carregar.mock.invocationCallOrder[0]
    );
    expect(carregar.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0]
    );
  });

  test("falha do aceite após Google mantém a sessão sem selecionar organização ou navegar", async () => {
    api.post.mockImplementation((url) => {
      if (url === "/auth/google") {
        return Promise.resolve({
          data: {
            token: "token-google",
            nome: "João Vitor",
            organizationId: "org-atual",
            emailVerified: true,
          },
        });
      }
      if (url === "/convites/token-convite-expirado/aceitar-existente") {
        return Promise.reject({ response: { data: { erro: "Este convite expirou." } } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    renderPagina([{ pathname: "/", state: { conviteToken: "token-convite-expirado" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Este convite expirou.", "erro");
    });
    expect(api.post).toHaveBeenNthCalledWith(1, "/auth/google", {
      idToken: "credential-de-teste",
    });
    expect(login).toHaveBeenCalledWith("token-google", "João Vitor", "org-atual", {
      redirecionar: false,
      emailVerified: true,
    });
    expect(trocarOrganizacao).not.toHaveBeenCalled();
    expect(carregar).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
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
