import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import VerificarEmail from "../pages/VerificarEmail";
import { lightTheme } from "../styles/theme";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// Mesma estratégia de RedefinirSenha.test.jsx: a página lê o token da URL
// (?token=...), então renderizamos posicionados numa rota específica —
// simulando o link recebido por e-mail.
vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

// Fase 8.1 (Bloco 1): a página agora consome useAuth para sincronizar
// emailVerified após a confirmação — mesma estratégia de
// ConfirmeSeuEmail.test.jsx/Login.test.jsx: mocka o hook diretamente em vez
// de montar o AuthProvider real.
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function renderPagina(caminho = "/verificar-email?token=token-valido-123") {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <ThemeProvider theme={lightTheme}>
        <Routes>
          <Route path="/verificar-email" element={<VerificarEmail />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("VerificarEmail (Fase 8.1 — Bloco 5)", () => {
  let marcarEmailVerificado;

  beforeEach(() => {
    api.post.mockReset();
    marcarEmailVerificado = vi.fn();
    // Padrão: deslogado por default; testes específicos de sessão
    // autenticada sobrescrevem com autenticado: true.
    useAuth.mockReturnValue({ autenticado: false, marcarEmailVerificado });
  });

  test("sem token na URL, mostra erro de link inválido e não chama a API", () => {
    renderPagina("/verificar-email");

    expect(
      screen.getByText("Este link de confirmação é inválido ou está incompleto.")
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("com token na URL, envia o token para POST /verificar-email e mostra loading antes da resposta", async () => {
    let resolverPost;
    api.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolverPost = resolve;
      })
    );

    renderPagina();

    expect(screen.getByText("Confirmando seu e-mail...")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/verificar-email", { token: "token-valido-123" });

    resolverPost({ data: {} });
    await waitFor(() => {
      expect(screen.getByText(/confirmado com sucesso/i)).toBeInTheDocument();
    });
  });

  test("sucesso mostra mensagem de confirmação e permite ir para o login", async () => {
    api.post.mockResolvedValueOnce({ data: {} });

    renderPagina();

    expect(
      await screen.findByText("E-mail confirmado com sucesso. Sua conta já está totalmente liberada.")
    ).toBeInTheDocument();
    expect(screen.getByText("Ir para o login")).toBeInTheDocument();
  });

  test("token inválido/expirado mostra a mensagem de erro retornada pelo backend", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { erro: "Token inválido ou expirado" } } });

    renderPagina();

    expect(await screen.findByText("Token inválido ou expirado")).toBeInTheDocument();
    expect(screen.getByText("Ir para o login")).toBeInTheDocument();
  });

  test("erro sem mensagem específica do backend mostra mensagem genérica (não expõe detalhes internos)", async () => {
    api.post.mockRejectedValueOnce(new Error("falha interna qualquer"));

    renderPagina();

    expect(await screen.findByText("Não foi possível confirmar seu e-mail.")).toBeInTheDocument();
  });

  test("botão 'Ir para o login' navega para /", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderPagina();

    await screen.findByText(/confirmado com sucesso/i);
    fireEvent.click(screen.getByText("Ir para o login"));

    // A rota de destino ("/") não está montada nesta árvore de teste
    // (só /verificar-email está registrada), então a melhor confirmação
    // observável é que a tela de verificação deixa de ser renderizada.
    await waitFor(() => {
      expect(screen.queryByText("Confirmação de e-mail")).not.toBeInTheDocument();
    });
  });

  test("chama a API no máximo uma vez mesmo que o componente rerenderize", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderPagina();

    await screen.findByText(/confirmado com sucesso/i);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  describe("sincronização do AuthContext após confirmação (Bloco 1)", () => {
    test("usuário deslogado confirma e-mail: não chama marcarEmailVerificado, mas o sucesso segue funcionando normalmente", async () => {
      useAuth.mockReturnValue({ autenticado: false, marcarEmailVerificado });
      api.post.mockResolvedValueOnce({ data: {} });

      renderPagina();

      await screen.findByText(/confirmado com sucesso/i);
      expect(marcarEmailVerificado).not.toHaveBeenCalled();
    });

    test("usuário autenticado confirma e-mail: chama marcarEmailVerificado para sincronizar o AuthContext/localStorage", async () => {
      useAuth.mockReturnValue({ autenticado: true, marcarEmailVerificado });
      api.post.mockResolvedValueOnce({ data: {} });

      renderPagina();

      await screen.findByText(/confirmado com sucesso/i);
      expect(marcarEmailVerificado).toHaveBeenCalledTimes(1);
    });

    test("erro na confirmação continua funcionando e não chama marcarEmailVerificado, mesmo autenticado", async () => {
      useAuth.mockReturnValue({ autenticado: true, marcarEmailVerificado });
      api.post.mockRejectedValueOnce({ response: { data: { erro: "Token inválido ou expirado" } } });

      renderPagina();

      expect(await screen.findByText("Token inválido ou expirado")).toBeInTheDocument();
      expect(marcarEmailVerificado).not.toHaveBeenCalled();
    });
  });
});