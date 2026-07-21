import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import ProjectSwitcher from "../components/ProjectSwitcher";
import { lightTheme } from "../styles/theme";
import { useProject } from "../context/ProjectContext";

// Mocka o contexto inteiro — este é um teste de componente, não de integração
// com o ProjectContext (que já é coberto por useProjetos.test.jsx).
vi.mock("../context/ProjectContext", () => ({
  useProject: vi.fn(),
}));

function renderComTema(ui) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

const PROJETOS = [
  { id: "p1", name: "Projeto Alpha" },
  { id: "p2", name: "Projeto Beta" },
];

function mockUseProject(overrides = {}) {
  const base = {
    projetos: PROJETOS,
    projectId: "p1",
    carregando: false,
    selecionarProjeto: vi.fn(),
    criarProjeto: vi.fn(),
    excluirProjeto: vi.fn(),
    renomearProjeto: vi.fn(),
  };
  const valor = { ...base, ...overrides };
  useProject.mockReturnValue(valor);
  return valor;
}

// Abre o dropdown e o menu de 3 pontos de um item específico — vários
// testes de exclusão/renomeio precisam desse mesmo caminho.
function abrirMenuDoItem(nomeProjeto) {
  fireEvent.click(screen.getByText("Projeto Alpha"));
  fireEvent.click(screen.getByLabelText(`Mais opções para ${nomeProjeto}`));
}

describe("ProjectSwitcher", () => {
  beforeEach(() => {
    useProject.mockReset();
  });

  test("não renderiza nada enquanto os projetos ainda estão carregando", () => {
    mockUseProject({ carregando: true, projetos: [] });

    const { container } = renderComTema(<ProjectSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  test("não renderiza nada quando não há projetos resolvidos", () => {
    mockUseProject({ carregando: false, projetos: [] });

    const { container } = renderComTema(<ProjectSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  test("mostra o nome do projeto ativo no seletor", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);

    expect(screen.getByText("Projeto Alpha")).toBeInTheDocument();
  });

  test("ao clicar, abre o dropdown com todos os projetos e marca o ativo", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    // "Projeto Alpha" aparece 2x agora: no trigger e na lista do dropdown.
    expect(screen.getAllByText("Projeto Alpha")).toHaveLength(2);
    expect(screen.getByText("Projeto Beta")).toBeInTheDocument();
  });

  test("selecionar outro projeto chama selecionarProjeto com o id certo e fecha o dropdown", () => {
    const valor = mockUseProject();

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));
    fireEvent.click(screen.getByText("Projeto Beta"));

    expect(valor.selecionarProjeto).toHaveBeenCalledWith("p2");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("abre o formulário de novo quadro ao clicar em 'Novo quadro'", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));
    fireEvent.click(screen.getByText("Novo quadro"));

    expect(screen.getByPlaceholderText("Nome do quadro")).toBeInTheDocument();
    expect(screen.getByText("Criar")).toBeInTheDocument();
  });

  test("botão 'Criar' fica desabilitado com o nome vazio", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));
    fireEvent.click(screen.getByText("Novo quadro"));

    expect(screen.getByText("Criar")).toBeDisabled();
  });

  test("criação bem-sucedida chama criarProjeto com nome e tipo, e fecha o formulário", async () => {
    const valor = mockUseProject();
    valor.criarProjeto.mockResolvedValueOnce({ id: "p3", name: "Projeto Gama" });

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));
    fireEvent.click(screen.getByText("Novo quadro"));

    fireEvent.change(screen.getByPlaceholderText("Nome do quadro"), {
      target: { value: "Projeto Gama" },
    });
    fireEvent.change(screen.getByDisplayValue("SaaS"), { target: { value: "app" } });
    fireEvent.click(screen.getByText("Criar"));

    await waitFor(() => {
      expect(valor.criarProjeto).toHaveBeenCalledWith("Projeto Gama", "app");
    });

    // Formulário e dropdown fecham após o sucesso.
    expect(screen.queryByPlaceholderText("Nome do quadro")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("erro ao criar (ex.: limite do plano) mostra a mensagem do backend e mantém o formulário aberto", async () => {
    const valor = mockUseProject();
    valor.criarProjeto.mockRejectedValueOnce({
      response: { data: { erro: "Plano gratuito permite apenas 1 projeto. Faça upgrade para o plano Pro para criar mais." } },
    });

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));
    fireEvent.click(screen.getByText("Novo quadro"));

    fireEvent.change(screen.getByPlaceholderText("Nome do quadro"), {
      target: { value: "Projeto Extra" },
    });
    fireEvent.click(screen.getByText("Criar"));

    expect(
      await screen.findByText(
        "Plano gratuito permite apenas 1 projeto. Faça upgrade para o plano Pro para criar mais."
      )
    ).toBeInTheDocument();
    // O formulário permanece visível para o usuário tentar de novo (ou cancelar).
    expect(screen.getByPlaceholderText("Nome do quadro")).toBeInTheDocument();
  });

  test("cancelar a criação limpa o formulário e volta para a lista", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));
    fireEvent.click(screen.getByText("Novo quadro"));

    fireEvent.change(screen.getByPlaceholderText("Nome do quadro"), {
      target: { value: "Rascunho" },
    });
    fireEvent.click(screen.getByTitle("Cancelar"));

    expect(screen.queryByPlaceholderText("Nome do quadro")).not.toBeInTheDocument();
    expect(screen.getByText("Novo quadro")).toBeInTheDocument();
  });

  test("cada item da lista tem um botão de 'mais opções'", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);
    fireEvent.click(screen.getByText("Projeto Alpha"));

    expect(screen.getAllByTitle("Mais opções")).toHaveLength(2);
  });

  test("abrir o menu de opções mostra Renomear e Excluir, sem trocar o projeto selecionado", () => {
    const valor = mockUseProject();

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");

    expect(screen.getByText("Renomear")).toBeInTheDocument();
    expect(screen.getByText("Excluir")).toBeInTheDocument();
    // Clicar no botão de "mais opções" não deve disparar a seleção do projeto.
    expect(valor.selecionarProjeto).not.toHaveBeenCalled();
  });

  test("clicar em excluir (dentro do menu) abre a confirmação e NÃO troca o projeto selecionado", () => {
    const valor = mockUseProject();

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Excluir"));

    expect(
      screen.getByText(/Tem certeza que deseja excluir "Projeto Beta"/)
    ).toBeInTheDocument();
    expect(valor.selecionarProjeto).not.toHaveBeenCalled();
  });

  test("confirmar exclusão chama excluirProjeto com o id certo e fecha o dropdown em caso de sucesso", async () => {
    const valor = mockUseProject();
    valor.excluirProjeto.mockResolvedValueOnce(true);

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Excluir"));
    fireEvent.click(screen.getByText("Excluir")); // botão de confirmação do ConfirmModal

    await waitFor(() => {
      expect(valor.excluirProjeto).toHaveBeenCalledWith("p2");
    });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Tem certeza que deseja excluir/)
    ).not.toBeInTheDocument();
  });

  test("se excluirProjeto falhar, fecha a confirmação mas mantém o dropdown aberto", async () => {
    const valor = mockUseProject();
    valor.excluirProjeto.mockResolvedValueOnce(false);

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Excluir"));
    fireEvent.click(screen.getByText("Excluir"));

    await waitFor(() => {
      expect(
        screen.queryByText(/Tem certeza que deseja excluir/)
      ).not.toBeInTheDocument();
    });
    // O erro em si (toast) é responsabilidade do hook, não do componente —
    // aqui só garantimos que a UI não fica presa numa confirmação resolvida.
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  test("cancelar a confirmação de exclusão não chama excluirProjeto", () => {
    const valor = mockUseProject();

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Excluir"));
    fireEvent.click(screen.getByText("Cancelar"));

    expect(valor.excluirProjeto).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Tem certeza que deseja excluir/)
    ).not.toBeInTheDocument();
  });

  test("clicar em renomear (dentro do menu) abre o modal com o nome atual preenchido", () => {
    mockUseProject();

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Renomear"));

    expect(screen.getByText("Renomear quadro")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Projeto Beta")).toBeInTheDocument();
  });

  test("salvar renomeio com sucesso chama renomearProjeto com o id e o novo nome, e fecha o modal", async () => {
    const valor = mockUseProject();
    valor.renomearProjeto.mockResolvedValueOnce(true);

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Renomear"));

    const campoNome = screen.getByDisplayValue("Projeto Beta");
    fireEvent.change(campoNome, { target: { value: "Projeto Beta Renomeado" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(valor.renomearProjeto).toHaveBeenCalledWith("p2", "Projeto Beta Renomeado");
    });

    await waitFor(() => {
      expect(screen.queryByText("Renomear quadro")).not.toBeInTheDocument();
    });
  });

  test("nome vazio ao renomear mostra erro de validação e NÃO chama renomearProjeto", () => {
    const valor = mockUseProject();

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Renomear"));

    fireEvent.change(screen.getByDisplayValue("Projeto Beta"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("Salvar"));

    expect(screen.getByText("O nome do quadro não pode ficar vazio.")).toBeInTheDocument();
    expect(valor.renomearProjeto).not.toHaveBeenCalled();
  });

  test("se renomearProjeto falhar, mantém o modal aberto com o texto já digitado", async () => {
    const valor = mockUseProject();
    valor.renomearProjeto.mockResolvedValueOnce(false);

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Renomear"));

    fireEvent.change(screen.getByDisplayValue("Projeto Beta"), {
      target: { value: "Tentativa Falha" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(valor.renomearProjeto).toHaveBeenCalledWith("p2", "Tentativa Falha");
    });

    // Modal continua aberto, com o texto preservado — o toast de erro é
    // responsabilidade do hook, não deste componente.
    expect(screen.getByDisplayValue("Tentativa Falha")).toBeInTheDocument();
  });

  test("cancelar o renomeio não chama renomearProjeto", () => {
    const valor = mockUseProject();

    renderComTema(<ProjectSwitcher />);
    abrirMenuDoItem("Projeto Beta");
    fireEvent.click(screen.getByText("Renomear"));
    fireEvent.click(screen.getByText("Cancelar"));

    expect(valor.renomearProjeto).not.toHaveBeenCalled();
    expect(screen.queryByText("Renomear quadro")).not.toBeInTheDocument();
  });
});