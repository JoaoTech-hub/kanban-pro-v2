import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../services/api";
import App from "../App";

// Reproduz, com a árvore de Providers REAL (App completo, não isolado),
// exatamente o cenário que a auditoria da Fase 8.1 encontrou: usuário
// autenticado, emailVerified: false, organizationId existente. Antes da
// correção, ProjectProvider e TeamProvider disparavam automaticamente
// GET /organizations/:id/projects e .../members assim que montados —
// endpoints bloqueados pelo backend (requireOrganization ->
// EMAIL_NAO_VERIFICADO) para quem ainda não confirmou o e-mail.
vi.mock("../services/api");

function mockApiComEmailNaoVerificado() {
  api.get.mockImplementation((url) => {
    if (url === "/organizations") {
      return Promise.resolve({
        data: [{ id: "org-1", name: "Minha Organização", role: "owner", plan: "free" }],
      });
    }
    // Simula o backend real: qualquer rota organization-scoped responde
    // 403 com o código específico enquanto o e-mail não for verificado.
    if (url.includes("/organizations/org-1/")) {
      return Promise.reject({
        response: {
          status: 403,
          data: {
            erro: "Confirme seu e-mail para acessar os dados da sua organização.",
            codigo: "EMAIL_NAO_VERIFICADO",
          },
        },
      });
    }
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: {} });
}

function chamouAlgumaRota(mockGet, substrings) {
  return mockGet.mock.calls.some(([url]) => substrings.some((s) => url.includes(s)));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("Providers x usuário não verificado — correção do bug da auditoria", () => {
  test("emailVerified: false NÃO dispara carregamento de projetos/equipe, não mostra toast de erro e não desloga o usuário", async () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("nome", "Fulano");
    localStorage.setItem("organizationId", "org-1");
    localStorage.setItem("emailVerified", "false");
    mockApiComEmailNaoVerificado();

    render(
      <MemoryRouter initialEntries={["/confirme-seu-email"]}>
        <App />
      </MemoryRouter>
    );

    // Chega na tela certa (prova que não foi deslogado/redirecionado).
    await waitFor(() => {
      expect(screen.getByText("Verifique seu e-mail")).toBeInTheDocument();
    });

    // Dá tempo de qualquer efeito indevido (fetch em segundo plano) disparar,
    // já que os providers ficam montados acima de <Routes> independente da
    // rota atual.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(chamouAlgumaRota(api.get, ["/projects", "/members", "/invites"])).toBe(false);
    expect(
      screen.queryByText("Não foi possível carregar a equipe.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Não foi possível carregar seus quadros.")
    ).not.toBeInTheDocument();

    // Nenhum logout indevido: sessão continua intacta e a tela de login não
    // é exibida.
    expect(localStorage.getItem("token")).toBe("fake-token");
    expect(screen.queryByText("Entre para gerenciar suas tarefas")).not.toBeInTheDocument();
  });

  test("[regressão] emailVerified: true continua carregando projetos/equipe normalmente", async () => {
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("nome", "Fulano");
    localStorage.setItem("organizationId", "org-1");
    localStorage.setItem("emailVerified", "true");

    api.get.mockImplementation((url) => {
      if (url === "/organizations") {
        return Promise.resolve({
          data: [{ id: "org-1", name: "Minha Organização", role: "owner", plan: "free" }],
        });
      }
      if (url === "/organizations/org-1/projects") {
        return Promise.resolve({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(chamouAlgumaRota(api.get, ["/projects"])).toBe(true);
    });
  });
});