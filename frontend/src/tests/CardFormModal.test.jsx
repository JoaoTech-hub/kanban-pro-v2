import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import CardFormModal from "../components/CardFormModal";
import { lightTheme } from "../styles/theme";

// A chamada real de API não deve rodar em teste de componente —
// só queremos validar o que é renderizado na tela.
vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const colunas = [
  { id: 1, titulo: "A Fazer" },
  { id: 2, titulo: "Concluído" },
];

function renderComTema(ui) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

describe("CardFormModal", () => {
  test("modo criação: mostra título 'Nova tarefa' e campos vazios", () => {
    renderComTema(
      <CardFormModal
        fechar={() => {}}
        card={null}
        colunas={colunas}
        atualizarCards={() => {}}
      />
    );

    expect(screen.getByText("Nova tarefa")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Título *")).toHaveValue("");
    // No modo criação não deve existir o botão de excluir
    expect(screen.queryByText("Excluir")).not.toBeInTheDocument();
  });

  test("modo edição: mostra título 'Editar tarefa', pré-preenche campos e exibe botão Excluir", () => {
    const card = {
      id: 10,
      titulo: "Revisar PR",
      descricao: "Revisar o pull request do time",
      prioridade: "alta",
      prazo: "2026-08-01",
      coluna_id: 1,
    };

    renderComTema(
      <CardFormModal
        fechar={() => {}}
        card={card}
        colunas={colunas}
        atualizarCards={() => {}}
      />
    );

    expect(screen.getByText("Editar tarefa")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Título *")).toHaveValue("Revisar PR");
    expect(screen.getByText("Excluir")).toBeInTheDocument();
  });
});
