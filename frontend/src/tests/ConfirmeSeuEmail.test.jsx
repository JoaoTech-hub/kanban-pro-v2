import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import ConfirmeSeuEmail from "../pages/ConfirmeSeuEmail";
import { lightTheme } from "../styles/theme";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Mesma estratégia de HeaderMenu.test.jsx / Login.test.jsx: mocka
// diretamente os contextos consumidos (useAuth, useToast) e a api.
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

function renderPagina() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>
        <ConfirmeSeuEmail />
      </ThemeProvider>
    </MemoryRouter>
  );
}

// Fase 8.1 (Bloco 2): variante com rotas reais registradas, usada para
// confirmar o destino do redirecionamento (<Navigate to="/dashboard" />)
// de forma observável — sem isso não dá pra distinguir "não redirecionou"
// de "redirecionou pra rota não registrada".
function renderComRotas(caminhoInicial = "/confirme-seu-email") {
  return render(
    <MemoryRouter initialEntries={[caminhoInicial]}>
      <ThemeProvider theme={lightTheme}>
        <Routes>
          <Route path="/confirme-seu-email" element={<ConfirmeSeuEmail />} />
          <Route path="/dashboard" element={<div>Página do Dashboard</div>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("ConfirmeSeuEmail (Fase 8.1 — Bloco 4)", () => {
  let logout, showToast;

  beforeEach(() => {
    api.post.mockReset();
    logout = vi.fn();
    showToast = vi.fn();
    // Fase 8.1 (Bloco 2): emailVerified: false por default — os testes
    // pré-existentes cobrem o comportamento de usuário ainda não verificado.
    useAuth.mockReturnValue({ logout, emailVerified: false });
    useToast.mockReturnValue({ showToast });
  });

  test("mostra o aviso de confirmação de e-mail", () => {
    renderPagina();
    expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();
    expect(screen.getByText(/link de confirmação/i)).toBeInTheDocument();
  });

  test("reenvio bem-sucedido dispara POST /reenviar-verificacao e mostra mensagem de sucesso", async () => {
    let resolverPost;
    api.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolverPost = resolve;
      })
    );

    renderPagina();
    fireEvent.click(screen.getByText("Reenviar e-mail de confirmação"));

    // Enquanto a requisição está em voo, o botão mostra loading e fica
    // desabilitado — impedindo múltiplos cliques simultâneos.
    expect(screen.getByText("Reenviando...")).toBeInTheDocument();
    expect(screen.getByText("Reenviando...")).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(1);

    resolverPost({ data: {} });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "E-mail de confirmação reenviado. Confira sua caixa de entrada.",
        "sucesso"
      );
    });
    expect(screen.getByText("Reenviar e-mail de confirmação")).not.toBeDisabled();
  });

  test("clique duplo durante o envio dispara apenas uma requisição", async () => {
    let resolverPost;
    api.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolverPost = resolve;
      })
    );

    renderPagina();
    const botao = screen.getByText("Reenviar e-mail de confirmação");
    fireEvent.click(botao);
    fireEvent.click(screen.getByText("Reenviando..."));
    fireEvent.click(screen.getByText("Reenviando..."));

    expect(api.post).toHaveBeenCalledTimes(1);

    resolverPost({ data: {} });
    await waitFor(() => expect(showToast).toHaveBeenCalled());
  });

  test("reenvio com erro 409 (cooldown) mostra mensagem amigável", async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 409, data: { erro: "Aguarde um pouco antes de solicitar um novo e-mail de confirmação." } },
    });

    renderPagina();
    fireEvent.click(screen.getByText("Reenviar e-mail de confirmação"));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "Aguarde um pouco antes de solicitar um novo e-mail de confirmação.",
        "erro"
      );
    });
    expect(screen.getByText("Reenviar e-mail de confirmação")).not.toBeDisabled();
  });

  test("reenvio com erro 401 (sessão inválida) mostra mensagem de sessão expirada", async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401 } });

    renderPagina();
    fireEvent.click(screen.getByText("Reenviar e-mail de confirmação"));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Sua sessão expirou. Faça login novamente.", "erro");
    });
  });

  test("erro genérico (ex.: falha de rede) mostra mensagem padrão", async () => {
    api.post.mockRejectedValueOnce(new Error("network error"));

    renderPagina();
    fireEvent.click(screen.getByText("Reenviar e-mail de confirmação"));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "Não foi possível reenviar o e-mail. Tente novamente.",
        "erro"
      );
    });
  });

  test("'Voltar para o login' chama logout()", () => {
    renderPagina();
    fireEvent.click(screen.getByText("Voltar para o login"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  describe("usuário já verificado (Bloco 2)", () => {
    test("emailVerified === false: permanece na tela de confirmação", () => {
      useAuth.mockReturnValue({ logout, emailVerified: false });
      renderComRotas();

      expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();
      expect(screen.queryByText("Página do Dashboard")).not.toBeInTheDocument();
    });

    test("emailVerified === true: navega para /dashboard", () => {
      useAuth.mockReturnValue({ logout, emailVerified: true });
      renderComRotas();

      expect(screen.getByText("Página do Dashboard")).toBeInTheDocument();
      expect(screen.queryByText("Verifique seu e-mail")).not.toBeInTheDocument();
    });

    test("emailVerified === true: não dispara reenvio automático nem mostra mensagem de e-mail reenviado", async () => {
      useAuth.mockReturnValue({ logout, emailVerified: true });
      renderComRotas();

      await screen.findByText("Página do Dashboard");
      expect(api.post).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });
  });
});