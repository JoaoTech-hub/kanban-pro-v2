import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useState } from "react";
import api from "../services/api";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { ProjectProvider } from "../context/ProjectContext";
import { KanbanProvider, useKanban } from "../context/KanbanContext";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api");

function ConsumidorKanban() {
  const { colunas, cards, carregouAoMenosUmaVez } = useKanban();
  return (
    <div>
      <span data-testid="colunas">{colunas.length}</span>
      <span data-testid="cards">{cards.length}</span>
      <span data-testid="carregou">{String(carregouAoMenosUmaVez)}</span>
    </div>
  );
}

// Simula a navegação real: o consumidor (a "página") monta e desmonta,
// mas os Providers (KanbanProvider, ProjectProvider) ficam vivos o tempo
// todo — exatamente como em App.jsx, onde eles vivem acima do <Routes>.
function Arvore({ mostrarConsumidor }) {
  return (
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <KanbanProvider>
              {mostrarConsumidor ? <ConsumidorKanban /> : <div>outra página</div>}
            </KanbanProvider>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function ArvoreComNavegacao() {
  const [naPaginaKanban, setNaPaginaKanban] = useState(true);
  return (
    <div>
      <button onClick={() => setNaPaginaKanban((v) => !v)}>navegar</button>
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <ProjectProvider>
              <KanbanProvider>
                {naPaginaKanban ? <ConsumidorKanban /> : <div>outra página (Equipe, por ex.)</div>}
              </KanbanProvider>
            </ProjectProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("nome", "Fulano");
  localStorage.setItem("organizationId", "org-1");

  api.get.mockImplementation((url) => {
    if (url.includes("/projects") && !url.includes("/colunas") && !url.includes("/cards")) {
      return Promise.resolve({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
    }
    if (url.includes("/colunas")) {
      return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
    }
    if (url.includes("/cards")) {
      return Promise.resolve({ data: [{ id: "card-1", colunaId: "col-1", titulo: "Tarefa" }] });
    }
    return Promise.resolve({ data: [] });
  });
});

describe("KanbanContext — dados persistem entre navegações (sem refetch desnecessário)", () => {
  test("busca colunas/cards exatamente uma vez ao montar", async () => {
    render(<Arvore mostrarConsumidor={true} />);

    await waitFor(() => expect(screen.getByTestId("carregou").textContent).toBe("true"));

    const chamadasColunas = api.get.mock.calls.filter(([url]) => url.includes("/colunas"));
    const chamadasCards = api.get.mock.calls.filter(([url]) => url.includes("/cards"));

    console.log("Chamadas a /colunas:", chamadasColunas.map((c) => c[0]));
    console.log("Chamadas a /cards:", chamadasCards.map((c) => c[0]));

    expect(chamadasColunas.length).toBe(1);
    expect(chamadasCards.length).toBe(1);
  });

  test("desmontar e remontar o CONSUMIDOR (simulando trocar de página e voltar) NÃO refaz o fetch, porque o Provider continua montado", async () => {
    const { rerender } = render(<Arvore mostrarConsumidor={true} />);
    await waitFor(() => expect(screen.getByTestId("carregou").textContent).toBe("true"));

    const chamadasAntes = api.get.mock.calls.filter(([url]) => url.includes("/colunas")).length;

    // "Navega" pra outra página — desmonta o consumidor, mas o
    // KanbanProvider (que envolve tudo) continua o mesmo, sem remontar.
    rerender(<Arvore mostrarConsumidor={false} />);
    // "Volta" pra página do Kanban.
    rerender(<Arvore mostrarConsumidor={true} />);

    await waitFor(() => expect(screen.getByTestId("colunas").textContent).toBe("1"));

    const chamadasDepois = api.get.mock.calls.filter(([url]) => url.includes("/colunas")).length;

    console.log(`Chamadas a /colunas — antes de navegar: ${chamadasAntes}, depois de ir-e-voltar: ${chamadasDepois}`);

    expect(chamadasDepois).toBe(chamadasAntes);
  });

  test("navegação real com estado (botão), múltiplas idas e vindas", async () => {
    render(<ArvoreComNavegacao />);
    await waitFor(() => expect(screen.getByTestId("carregou").textContent).toBe("true"));

    const botao = screen.getByText("navegar");

    fireEvent.click(botao); // vai pra "outra página"
    fireEvent.click(botao); // volta pro Kanban
    fireEvent.click(botao); // vai de novo
    fireEvent.click(botao); // volta de novo

    await waitFor(() => expect(screen.getByTestId("colunas").textContent).toBe("1"));

    const totalChamadasColunas = api.get.mock.calls.filter(([url]) => url.includes("/colunas")).length;
    console.log(`Total de chamadas a /colunas após 4 navegações: ${totalChamadasColunas}`);

    expect(totalChamadasColunas).toBe(1);
  });

  test("com projectId salvo no localStorage, a busca de colunas/cards começa em PARALELO com a lista de projetos (não espera ela terminar)", async () => {
    localStorage.setItem("projetoAtivo:org-1", "proj-1");

    // Nunca resolve a lista de projetos de propósito — se a busca de
    // colunas/cards dependesse dela terminar primeiro, este teste nunca
    // veria a chamada a /colunas acontecer.
    let resolverProjetos;
    const promessaProjetos = new Promise((r) => { resolverProjetos = r; });
    api.get.mockImplementation((url) => {
      if (url.includes("/colunas")) return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
      if (url.includes("/cards")) return Promise.resolve({ data: [] });
      if (url.includes("/projects") && !url.includes("/colunas") && !url.includes("/cards")) {
        return promessaProjetos;
      }
      return Promise.resolve({ data: [] });
    });

    render(<Arvore mostrarConsumidor={true} />);

    // A busca de colunas já deve ter acontecido MESMO com a lista de
    // projetos ainda pendurada — prova que não é mais sequencial.
    await waitFor(() => {
      const chamadas = api.get.mock.calls.filter(([url]) => url.includes("/colunas")).length;
      expect(chamadas).toBe(1);
    });

    resolverProjetos({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
  });
});