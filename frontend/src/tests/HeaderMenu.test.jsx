import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import HeaderMenu from "../components/HeaderMenu";
import { lightTheme } from "../styles/theme";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";

// Teste de componente isolado — mocka os três contextos que o HeaderMenu
// consome. A lógica de cada um (persistência, otimismo/rollback, etc.) já
// é coberta nos próprios testes de hook/contexto; aqui só verificamos que
// o componente chama a função certa com o argumento certo.
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../context/ThemeContext", () => ({
  useTheme: vi.fn(),
}));
vi.mock("../context/ProjectContext", () => ({
  useProject: vi.fn(),
}));

function renderComTema(ui) {
  // HeaderMenu usa useNavigate() (item "Configurações"), que só funciona
  // dentro do contexto de um Router — MemoryRouter é o padrão pra testes.
  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

const PROJETO = { id: "proj-1", name: "Meu Quadro", background: null };

function mockContextos({
  logout = vi.fn(),
  dark = false,
  toggleTheme = vi.fn(),
  atualizarFundoProjeto = vi.fn(),
} = {}) {
  useAuth.mockReturnValue({ logout });
  useTheme.mockReturnValue({ dark, toggleTheme });
  useProject.mockReturnValue({ atualizarFundoProjeto });
  return { logout, toggleTheme, atualizarFundoProjeto };
}

function abrirMenu() {
  fireEvent.click(screen.getByLabelText("Mais opções"));
}

describe("HeaderMenu", () => {
  beforeEach(() => {
    useAuth.mockReset();
    useTheme.mockReset();
    useProject.mockReset();
  });

  test("o popover começa fechado", () => {
    mockContextos();
    renderComTema(<HeaderMenu projeto={PROJETO} />);

    expect(screen.queryByText("Fundo do quadro")).not.toBeInTheDocument();
  });

  test("clicar no botão abre o popover com fundo do quadro, tema e sair", () => {
    mockContextos();
    renderComTema(<HeaderMenu projeto={PROJETO} />);

    abrirMenu();

    expect(screen.getByText("Fundo do quadro")).toBeInTheDocument();
    expect(screen.getByText("Modo escuro")).toBeInTheDocument();
    expect(screen.getByText("Sair")).toBeInTheDocument();
  });

  test("sem projeto ativo, não mostra a seção de fundo do quadro (só tema e sair)", () => {
    mockContextos();
    renderComTema(<HeaderMenu projeto={null} />);

    abrirMenu();

    expect(screen.queryByText("Fundo do quadro")).not.toBeInTheDocument();
    expect(screen.getByText("Modo escuro")).toBeInTheDocument();
    expect(screen.getByText("Sair")).toBeInTheDocument();
  });

  test("clicar numa cor chama atualizarFundoProjeto com o id do projeto e a chave certa, e fecha o popover", () => {
    const { atualizarFundoProjeto } = mockContextos();
    renderComTema(<HeaderMenu projeto={PROJETO} />);

    abrirMenu();
    fireEvent.click(screen.getByLabelText("Oceano"));

    expect(atualizarFundoProjeto).toHaveBeenCalledWith("proj-1", "oceano");
    expect(screen.queryByText("Fundo do quadro")).not.toBeInTheDocument();
  });

  test("clicar no swatch padrão chama atualizarFundoProjeto com `null`", () => {
    const { atualizarFundoProjeto } = mockContextos();
    renderComTema(<HeaderMenu projeto={{ ...PROJETO, background: "vinho" }} />);

    abrirMenu();
    fireEvent.click(screen.getByLabelText("Fundo padrão"));

    expect(atualizarFundoProjeto).toHaveBeenCalledWith("proj-1", null);
  });

  test("mostra 'Modo escuro' quando o tema está claro, e chama toggleTheme ao clicar", () => {
    const { toggleTheme } = mockContextos({ dark: false });
    renderComTema(<HeaderMenu projeto={PROJETO} />);

    abrirMenu();
    fireEvent.click(screen.getByText("Modo escuro"));

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  test("mostra 'Modo claro' quando o tema já está escuro", () => {
    mockContextos({ dark: true });
    renderComTema(<HeaderMenu projeto={PROJETO} />);

    abrirMenu();

    expect(screen.getByText("Modo claro")).toBeInTheDocument();
    expect(screen.queryByText("Modo escuro")).not.toBeInTheDocument();
  });

  test("clicar em 'Sair' chama logout", () => {
    const { logout } = mockContextos();
    renderComTema(<HeaderMenu projeto={PROJETO} />);

    abrirMenu();
    fireEvent.click(screen.getByText("Sair"));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  test("clicar em 'Configurações' navega pra /configuracoes e fecha o popover", () => {
    mockContextos();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ThemeProvider theme={lightTheme}>
          <Routes>
            <Route path="/dashboard" element={<HeaderMenu projeto={PROJETO} />} />
            <Route path="/configuracoes" element={<div>Página de configurações</div>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );

    abrirMenu();
    fireEvent.click(screen.getByText("Configurações"));

    expect(screen.getByText("Página de configurações")).toBeInTheDocument();
  });

  test("clicar fora do popover fecha o menu", () => {
    mockContextos();
    renderComTema(
      <div>
        <div data-testid="fora">fora do menu</div>
        <HeaderMenu projeto={PROJETO} />
      </div>
    );

    abrirMenu();
    expect(screen.getByText("Fundo do quadro")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("fora"));

    expect(screen.queryByText("Fundo do quadro")).not.toBeInTheDocument();
  });
});