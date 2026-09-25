import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import Registro from "../pages/Registro";
import { lightTheme } from "../styles/theme";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// Teste de componente isolado — mesma estratégia usada em EsqueciSenha.test.jsx
// (api mockada) e em HeaderMenu.test.jsx (useAuth mockado diretamente), já que
// Registro.jsx só depende de api + useAuth().login + useNavigate.
vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, useNavigate: () => mockNavigate };
});

function renderPagina() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>
        <Registro />
      </ThemeProvider>
    </MemoryRouter>
  );
}

function preencherFormulario({
  nome = "João Vitor",
  email = "joao@teste.com",
  senha = "senha123",
  confirmarSenha = "senha123",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText("Nome"), { target: { value: nome } });
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: senha } });
  fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), {
    target: { value: confirmarSenha },
  });
}

describe("Registro — integração com emailVerified (Fase 8.1)", () => {
  let login;

  beforeEach(() => {
    api.post.mockReset();
    mockNavigate.mockReset();
    login = vi.fn();
    useAuth.mockReturnValue({ login });
  });

  test("cadastro com sucesso e emailVerified: false NÃO trata o usuário como verificado — encaminha para /confirme-seu-email", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        mensagem: "Usuário criado com sucesso",
        token: "token-novo",
        nome: "João Vitor",
        organizationId: "org-1",
        emailVerified: false,
      },
    });

    renderPagina();
    preencherFormulario();
    fireEvent.click(screen.getByText("Criar conta"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/registro", {
        nome: "João Vitor",
        email: "joao@teste.com",
        senha: "senha123",
      });
    });

    // login() recebe redirecionar: false — quem decide o destino agora é a
    // própria página, com base em emailVerified, e não a navegação padrão
    // do AuthContext (que sempre iria para /dashboard).
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("token-novo", "João Vitor", "org-1", {
        redirecionar: false,
        emailVerified: false,
      });
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/confirme-seu-email");
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
  });

  test("cadastro com sucesso e emailVerified: true segue para /dashboard normalmente", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        mensagem: "Usuário criado com sucesso",
        token: "token-novo",
        nome: "João Vitor",
        organizationId: "org-1",
        emailVerified: true,
      },
    });

    renderPagina();
    preencherFormulario();
    fireEvent.click(screen.getByText("Criar conta"));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("token-novo", "João Vitor", "org-1", {
        redirecionar: false,
        emailVerified: true,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  test("[regressão] senhas diferentes bloqueiam o envio sem chamar a API", () => {
    renderPagina();
    preencherFormulario({ senha: "senha123", confirmarSenha: "outraSenha1" });
    fireEvent.click(screen.getByText("Criar conta"));

    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  test("[regressão] senha fraca bloqueia o envio sem chamar a API", () => {
    renderPagina();
    preencherFormulario({ senha: "abc", confirmarSenha: "abc" });
    fireEvent.click(screen.getByText("Criar conta"));

    expect(
      screen.getByText(
        "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número."
      )
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  test("[regressão] erro retornado pela API é exibido e login() não é chamado", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { erro: "E-mail já cadastrado" } } });

    renderPagina();
    preencherFormulario();
    fireEvent.click(screen.getByText("Criar conta"));

    expect(await screen.findByText("E-mail já cadastrado")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("[regressão] link 'Entrar' continua navegando para a tela de login", () => {
    renderPagina();
    fireEvent.click(screen.getByText("Entrar"));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});