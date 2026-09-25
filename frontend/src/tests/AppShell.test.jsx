import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";

// Isola AppShell do resto da árvore: mocka useAuth (só `autenticado` importa
// aqui) e o próprio Sidebar, que tem suas próprias dependências de contexto
// (useOrganizacoes, useProject etc.) irrelevantes para o que este arquivo
// testa — a decisão de MOSTRAR ou NÃO a Sidebar, não o conteúdo dela.
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../components/Sidebar", () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

function renderEm(pathname, autenticado) {
  useAuth.mockReturnValue({ autenticado });
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell>
        <div data-testid="conteudo">conteúdo da página</div>
      </AppShell>
    </MemoryRouter>
  );
}

describe("AppShell — exibição da Sidebar por rota (Fase 8.1)", () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  test("/confirme-seu-email autenticado NÃO mostra a Sidebar", () => {
    renderEm("/confirme-seu-email", true);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("conteudo")).toBeInTheDocument();
  });

  test("/verificar-email autenticado NÃO mostra a Sidebar", () => {
    renderEm("/verificar-email", true);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  test("/verificar-email deslogado (caso comum, link de e-mail) também NÃO mostra a Sidebar", () => {
    renderEm("/verificar-email", false);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  test("[regressão] rotas públicas existentes continuam sem Sidebar", () => {
    for (const rota of ["/", "/registro", "/esqueci-senha", "/redefinir-senha"]) {
      const { unmount } = renderEm(rota, true);
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
      unmount();
    }
  });

  test("[regressão] prefixo /convites/ continua sem Sidebar", () => {
    renderEm("/convites/token-123", true);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  test("[regressão] rota protegida autenticada (ex.: /dashboard) continua mostrando a Sidebar", () => {
    renderEm("/dashboard", true);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("conteudo")).toBeInTheDocument();
  });

  test("[regressão] rota protegida sem autenticação não mostra a Sidebar", () => {
    renderEm("/dashboard", false);
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });
});