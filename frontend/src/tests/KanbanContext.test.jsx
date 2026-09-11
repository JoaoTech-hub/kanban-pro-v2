import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import api from "../services/api";
import { AuthProvider, useAuth } from "../context/AuthContext";
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

// Fase D / 7.3: mesma árvore de sempre, mas com um botão que troca a
// organização ativa de verdade (via useAuth().trocarOrganizacao), do mesmo
// jeito que o seletor de organização faria — sem desmontar nenhum Provider.
function ConsumidorComTrocaDeOrganizacao() {
  const { trocarOrganizacao } = useAuth();
  const { colunas, cards, carregouAoMenosUmaVez } = useKanban();
  return (
    <div>
      <button onClick={() => trocarOrganizacao("org-2")}>trocar organização</button>
      <span data-testid="colunas">{colunas.length}</span>
      <span data-testid="cards">{cards.length}</span>
      <span data-testid="carregou">{String(carregouAoMenosUmaVez)}</span>
    </div>
  );
}

function ArvoreComTrocaDeOrganizacao() {
  return (
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <KanbanProvider>
              <ConsumidorComTrocaDeOrganizacao />
            </KanbanProvider>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
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

    // Resolve dentro de act() e espera o React processar a atualização de
    // estado que isso dispara no ProjectProvider — sem isso, o teste
    // termina antes do efeito assentar e o React acusa "update not
    // wrapped in act(...)", mesmo o teste em si passando.
    await act(async () => {
      resolverProjetos({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
    });
  });
});

describe("Fase D / 7.3 — projectId nunca vaza da organização anterior ao trocar de organização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "fake-token");
    localStorage.setItem("nome", "Fulano");
    localStorage.setItem("organizationId", "org-1");
    localStorage.setItem("projetoAtivo:org-1", "proj-1");
    localStorage.setItem("projetoAtivo:org-2", "proj-2");

    api.get.mockImplementation((url) => {
      if (url === "/organizations/org-1/projects") {
        return Promise.resolve({ data: [{ id: "proj-1", name: "Quadro Org 1" }] });
      }
      if (url === "/organizations/org-2/projects") {
        return Promise.resolve({ data: [{ id: "proj-2", name: "Quadro Org 2" }] });
      }
      if (url === "/organizations/org-1/projects/proj-1/colunas") {
        return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
      }
      if (url === "/organizations/org-1/projects/proj-1/cards") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/organizations/org-2/projects/proj-2/colunas") {
        return Promise.resolve({ data: [{ id: "col-2", nome: "A Fazer" }] });
      }
      if (url === "/organizations/org-2/projects/proj-2/cards") {
        return Promise.resolve({ data: [{ id: "card-2", colunaId: "col-2", titulo: "Tarefa Org 2" }] });
      }
      // Qualquer OUTRA combinação (em especial org-2 misturado com o
      // projectId de org-1) é exatamente o bug original — devolve um erro
      // pra deixar isso visível caso volte a acontecer, em vez de
      // silenciosamente "funcionar" com dado errado.
      return Promise.reject({ response: { status: 404, data: { erro: "não encontrado" } } });
    });
  });

  test(
    "trocar de organização nunca dispara uma busca de colunas/cards usando o projectId da organização anterior, e a nova organização carrega normalmente",
    async () => {
      render(<ArvoreComTrocaDeOrganizacao />);

      await waitFor(() => expect(screen.getByTestId("carregou").textContent).toBe("true"));
      expect(screen.getByTestId("colunas").textContent).toBe("1"); // org-1 carregada

      fireEvent.click(screen.getByText("trocar organização"));

      // A nova organização precisa terminar de carregar normalmente.
      await waitFor(() => {
        const chamadasColunasOrg2 = api.get.mock.calls.filter(
          ([url]) => url === "/organizations/org-2/projects/proj-2/colunas"
        );
        expect(chamadasColunasOrg2.length).toBeGreaterThan(0);
      });
      await waitFor(() => expect(screen.getByTestId("cards").textContent).toBe("1"));

      // Nunca pode ter existido, em nenhum momento da troca, uma chamada
      // misturando a nova organização com o projectId da organização
      // ANTERIOR — essa combinação inválida (.../org-2/projects/proj-1/...)
      // é exatamente o sintoma original: sem a correção em useProjetos.js,
      // o KanbanContext ainda enxergava `projectId="proj-1"` por uma
      // fração de segundo depois de `organizationId` já ser "org-2".
      const chamadasComOrganizacaoEProjetoTrocados = api.get.mock.calls.filter(
        ([url]) => url.includes("/organizations/org-2/") && url.includes("/proj-1/")
      );
      expect(chamadasComOrganizacaoEProjetoTrocados).toHaveLength(0);
    }
  );
});