import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import RedefinirSenha from "../pages/RedefinirSenha";
import { lightTheme } from "../styles/theme";
import api from "../services/api";

// Mesma estratégia usada em EsqueciSenha.test.jsx: a chamada real de API
// não deve rodar em teste de componente.
vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

// Renderiza a página já posicionada em uma URL específica, para simular
// o link que o usuário recebe por e-mail (?token=...) — ou a ausência dele.
function renderPagina(caminho = "/redefinir-senha?token=token-valido-123") {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <ThemeProvider theme={lightTheme}>
        <Routes>
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("RedefinirSenha", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  test("sem token na URL, mostra tela de link inválido e não renderiza o formulário", () => {
    renderPagina("/redefinir-senha");

    expect(screen.getByText("Link inválido")).toBeInTheDocument();
    expect(
      screen.getByText("Este link de redefinição de senha é inválido ou está incompleto.")
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Nova senha")).not.toBeInTheDocument();
    expect(screen.getByText("Solicitar um novo link")).toBeInTheDocument();
  });

  test("com token na URL, renderiza o formulário de nova senha", () => {
    renderPagina();

    expect(screen.getByText("Escolha sua nova senha")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nova senha")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirmar nova senha")).toBeInTheDocument();
    expect(screen.getByText("Redefinir senha")).toBeInTheDocument();
  });

  test("bloqueia o envio quando as senhas não coincidem, sem chamar a API", () => {
    renderPagina();

    fireEvent.change(screen.getByPlaceholderText("Nova senha"), {
      target: { value: "senha123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmar nova senha"), {
      target: { value: "senha456" },
    });
    fireEvent.click(screen.getByText("Redefinir senha"));

    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("bloqueia o envio quando a senha não cumpre a política de senha forte, sem chamar a API", () => {
    renderPagina();

    fireEvent.change(screen.getByPlaceholderText("Nova senha"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmar nova senha"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByText("Redefinir senha"));

    expect(
      screen.getByText(
        "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número."
      )
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("envio bem-sucedido chama POST /redefinir-senha com token e nova senha, e mostra confirmação", async () => {
    api.post.mockResolvedValueOnce({ data: { mensagem: "ok" } });
    renderPagina("/redefinir-senha?token=token-valido-123");

    fireEvent.change(screen.getByPlaceholderText("Nova senha"), {
      target: { value: "novaSenha123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmar nova senha"), {
      target: { value: "novaSenha123" },
    });
    fireEvent.click(screen.getByText("Redefinir senha"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/redefinir-senha", {
        token: "token-valido-123",
        novaSenha: "novaSenha123",
      });
    });

    expect(
      await screen.findByText(/Sua senha foi redefinida com sucesso/i)
    ).toBeInTheDocument();
    // O formulário some após o sucesso — só resta o botão de ir para o login.
    expect(screen.queryByPlaceholderText("Nova senha")).not.toBeInTheDocument();
    expect(screen.getByText("Ir para o login")).toBeInTheDocument();
  });

  test("exibe a mensagem de erro do backend quando o token é inválido ou expirado", async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { erro: "Token inválido ou expirado" } },
    });
    renderPagina();

    fireEvent.change(screen.getByPlaceholderText("Nova senha"), {
      target: { value: "novaSenha123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirmar nova senha"), {
      target: { value: "novaSenha123" },
    });
    fireEvent.click(screen.getByText("Redefinir senha"));

    expect(await screen.findByText("Token inválido ou expirado")).toBeInTheDocument();
    // O formulário permanece visível para nova tentativa (ex.: solicitar novo link).
    expect(screen.getByPlaceholderText("Nova senha")).toBeInTheDocument();
  });
});