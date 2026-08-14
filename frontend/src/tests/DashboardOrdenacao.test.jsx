import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../services/api";
import App from "../App";

vi.mock("../services/api");

function cardApi(id, colunaId, ordem, titulo) {
  return { id, colunaId, ordem, titulo: titulo ?? `Card ${id}` };
}

function nomesNaOrdemRenderizada() {
  // Os títulos dos cards são renderizados em <strong> (ver Card.jsx).
  return screen.getAllByText(/^Card /).map((el) => el.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("nome", "Fulano");
  localStorage.setItem("organizationId", "org-1");
  localStorage.setItem("projetoAtivo:org-1", "proj-1");

  api.post.mockResolvedValue({ data: {} });
});

describe("Dashboard — cards renderizam respeitando `ordem`, não a ordem de chegada da API", () => {
  test("coluna única: cards fora de ordem na resposta da API aparecem em ordem crescente de `ordem` na tela", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/organizations") {
        return Promise.resolve({ data: [{ id: "org-1", name: "Org", role: "owner", plan: "free" }] });
      }
      if (url.includes("/members")) return Promise.resolve({ data: [] });
      if (url.includes("/invites")) return Promise.resolve({ data: [] });
      if (url.includes("/colunas")) {
        return Promise.resolve({ data: [{ id: "col-1", nome: "A Fazer" }] });
      }
      if (url.includes("/cards")) {
        // Propositalmente fora de ordem — a API não garante que a ordem de
        // chegada no array corresponda à `ordem`.
        return Promise.resolve({
          data: [
            cardApi("c", "col-1", 2, "Card Terceiro"),
            cardApi("a", "col-1", 0, "Card Primeiro"),
            cardApi("b", "col-1", 1, "Card Segundo"),
          ],
        });
      }
      if (url.includes("/projects")) {
        return Promise.resolve({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument(), {
      timeout: 3000,
    });

    await waitFor(() => expect(screen.getByText("Card Primeiro")).toBeInTheDocument(), { timeout: 3000 });

    expect(nomesNaOrdemRenderizada()).toEqual(["Card Primeiro", "Card Segundo", "Card Terceiro"]);
  });

  test("duas colunas: cada uma ordena seus próprios cards de forma independente", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/organizations") {
        return Promise.resolve({ data: [{ id: "org-1", name: "Org", role: "owner", plan: "free" }] });
      }
      if (url.includes("/members")) return Promise.resolve({ data: [] });
      if (url.includes("/invites")) return Promise.resolve({ data: [] });
      if (url.includes("/colunas")) {
        return Promise.resolve({
          data: [{ id: "col-1", nome: "A Fazer" }, { id: "col-2", nome: "Feito" }],
        });
      }
      if (url.includes("/cards")) {
        return Promise.resolve({
          data: [
            cardApi("y", "col-2", 1, "Card Y-Segundo"),
            cardApi("c", "col-1", 2, "Card Terceiro"),
            cardApi("x", "col-2", 0, "Card X-Primeiro"),
            cardApi("a", "col-1", 0, "Card Primeiro"),
            cardApi("b", "col-1", 1, "Card Segundo"),
          ],
        });
      }
      if (url.includes("/projects")) {
        return Promise.resolve({ data: [{ id: "proj-1", name: "Meu Quadro" }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument(), {
      timeout: 3000,
    });
    await waitFor(() => expect(screen.getByText("Card Primeiro")).toBeInTheDocument(), { timeout: 3000 });

    expect(nomesNaOrdemRenderizada()).toEqual([
      "Card Primeiro",
      "Card Segundo",
      "Card Terceiro",
      "Card X-Primeiro",
      "Card Y-Segundo",
    ]);
  });
});