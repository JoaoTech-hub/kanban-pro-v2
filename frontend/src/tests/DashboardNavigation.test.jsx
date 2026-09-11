import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import api from "../services/api";
import App from "../App";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api");

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("nome", "Fulano");
  localStorage.setItem("organizationId", "org-1");
  // Simula uma visita anterior real: já existe um projeto ativo salvo.
  localStorage.setItem("projetoAtivo:org-1", "proj-1");

  api.get.mockImplementation((url) => {
    if (url === "/organizations") {
      return Promise.resolve({ data: [{ id: "org-1", name: "Org", role: "owner", plan: "free" }] });
    }
    if (url.includes("/members")) return Promise.resolve({ data: [] });
    if (url.includes("/invites")) return Promise.resolve({ data: [] });
    if (url.includes("/colunas")) return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
    if (url.includes("/cards")) return Promise.resolve({ data: [] });
    if (url.includes("/projects")) {
      return Promise.resolve({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
    }
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: {} });
});

describe("Navegação Dashboard <-> outras páginas — sem flash de loading nem fetch redundante", () => {
  test("na SEGUNDA visita ao Dashboard, 'Carregando' NÃO deveria aparecer em nenhum momento", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    // Espera a primeira carga terminar de verdade.
    await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument(), {
      timeout: 3000,
    });

    // Vai pra Equipe.
    const linkEquipe = await screen.findByText("Equipe");
    fireEvent.click(linkEquipe);
    await waitFor(() => expect(screen.getByText(/Gerencie quem tem acesso/i)).toBeInTheDocument());

    // Volta pro Dashboard — AQUI é o momento crítico.
    const linkDashboard = await screen.findByText("Dashboard");
    fireEvent.click(linkDashboard);

    // Textos específicos do Dashboard (não o spinner genérico do Suspense,
    // que é aceitável durante a troca de rota) — captura em vários pontos
    // do tempo pra ver se "Carregando seu quadro..." chega a aparecer e
    // por quanto tempo fica visível.
    const capturas = [];
    for (let i = 0; i < 6; i++) {
      capturas.push({
        tick: i,
        texto: screen.queryByText(/Carregando seu quadro/i)?.textContent ?? null,
      });
      await new Promise((r) => setTimeout(r, 20));
    }

    console.log("Capturas de 'Carregando seu quadro...' ao longo do tempo:", JSON.stringify(capturas));

    const apareceuEmAlgumMomento = capturas.some((c) => c.texto !== null);

    expect(apareceuEmAlgumMomento).toBe(false);
  });

  test("nenhum fetch extra de /organizations ou /projects acontece só por navegar entre páginas", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument(), {
      timeout: 3000,
    });

    const chamadasProjectsAntes = api.get.mock.calls.filter(
      ([url]) => url.includes("/projects") && !url.includes("/colunas") && !url.includes("/cards")
    ).length;
    const chamadasOrgAntes = api.get.mock.calls.filter(([url]) => url === "/organizations").length;

    // Navega bastante: Dashboard -> Equipe -> Dashboard -> Projetos ->
    // Dashboard -> Tarefas -> Dashboard -> Projetos -> Tarefas -> Projetos.
    const sequencia = ["Equipe", "Dashboard", "Colunas", "Dashboard", "Tarefas", "Dashboard", "Colunas", "Tarefas", "Colunas"];
    for (const texto of sequencia) {
      const link = await screen.findByText(texto);
      fireEvent.click(link);
      // A troca de rota carrega a página via React.lazy — a resolução do
      // Suspense acontece nesse intervalo, então a espera precisa estar
      // dentro de act() (senão o React acusa "suspended resource finished
      // loading... not wrapped in act(...)", mesmo o teste passando).
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
    }

    const chamadasProjectsDepois = api.get.mock.calls.filter(
      ([url]) => url.includes("/projects") && !url.includes("/colunas") && !url.includes("/cards")
    ).length;
    const chamadasOrgDepois = api.get.mock.calls.filter(([url]) => url === "/organizations").length;

    console.log(
      `GET /projects — antes: ${chamadasProjectsAntes}, depois de 9 navegações: ${chamadasProjectsDepois}`
    );
    console.log(
      `GET /organizations — antes: ${chamadasOrgAntes}, depois de 9 navegações: ${chamadasOrgDepois}`
    );

    expect(chamadasProjectsDepois).toBe(chamadasProjectsAntes);
    expect(chamadasOrgDepois).toBe(chamadasOrgAntes);
  });
});