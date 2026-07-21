import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import EsqueciSenha from "../pages/EsqueciSenha";
import { lightTheme } from "../styles/theme";
import api from "../services/api";

// Mesma estratégia usada em CardFormModal.test.jsx: a chamada real de API
// não deve rodar em teste de componente.
vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

function renderPagina() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>
        <EsqueciSenha />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("EsqueciSenha", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  test("renderiza o formulário inicial com campo de e-mail", () => {
    renderPagina();

    expect(
      screen.getByText("Informe seu e-mail para receber o link de recuperação")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
    expect(screen.getByText("Enviar link de recuperação")).toBeInTheDocument();
  });

  test("envio bem-sucedido chama POST /esqueci-senha e mostra mensagem genérica de sucesso", async () => {
    api.post.mockResolvedValueOnce({ data: { mensagem: "ok" } });
    renderPagina();

    fireEvent.change(screen.getByPlaceholderText("E-mail"), {
      target: { value: "usuario@teste.com" },
    });
    fireEvent.click(screen.getByText("Enviar link de recuperação"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/esqueci-senha", { email: "usuario@teste.com" });
    });

    expect(
      await screen.findByText(/você receberá um link para/i)
    ).toBeInTheDocument();
    // O formulário some após o envio — não deve mais existir o campo de e-mail.
    expect(screen.queryByPlaceholderText("E-mail")).not.toBeInTheDocument();
  });

  test("mostra a mesma mensagem de sucesso mesmo quando o e-mail não existe (sem enumeração)", async () => {
    // O backend responde 200 genérico independentemente de o e-mail existir —
    // este teste garante que o frontend não tenta diferenciar os dois casos.
    api.post.mockResolvedValueOnce({ data: { mensagem: "ok" } });
    renderPagina();

    fireEvent.change(screen.getByPlaceholderText("E-mail"), {
      target: { value: "naoexiste@teste.com" },
    });
    fireEvent.click(screen.getByText("Enviar link de recuperação"));

    expect(
      await screen.findByText(/você receberá um link para/i)
    ).toBeInTheDocument();
  });

  test("exibe mensagem de erro quando a API falha", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { erro: "Erro de validação" } } });
    renderPagina();

    fireEvent.change(screen.getByPlaceholderText("E-mail"), {
      target: { value: "usuario@teste.com" },
    });
    fireEvent.click(screen.getByText("Enviar link de recuperação"));

    expect(await screen.findByText("Erro de validação")).toBeInTheDocument();
    // O formulário permanece visível para nova tentativa.
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
  });
});