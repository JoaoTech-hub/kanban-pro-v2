import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { OrganizationsProvider, useOrganizationsContext } from "../context/OrganizationsContext";

vi.mock("../services/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: vi.fn() }));

function ConsumidorOrganizacoes() {
  const { organizacoes, carregando, carregar } = useOrganizationsContext();

  return (
    <div>
      <span data-testid="organizacoes">{organizacoes.map((org) => org.id).join(",")}</span>
      <span data-testid="carregando">{String(carregando)}</span>
      <button type="button" onClick={() => carregar()}>Recarregar organizações</button>
    </div>
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("OrganizationsContext", () => {
  beforeEach(() => {
    api.get.mockReset();
    useAuth.mockReturnValue({ token: "token-teste" });
    useToast.mockReturnValue({ showToast: vi.fn() });
  });

  test("uma resposta antiga não sobrescreve o resultado do carregamento mais recente", async () => {
    const requisicaoA = deferred();
    const requisicaoB = deferred();
    api.get.mockReturnValueOnce(requisicaoA.promise).mockReturnValueOnce(requisicaoB.promise);

    render(
      <OrganizationsProvider>
        <ConsumidorOrganizacoes />
      </OrganizationsProvider>
    );

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Recarregar organizações" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));

    await act(async () => {
      requisicaoB.resolve({ data: [{ id: "org-antiga" }, { id: "org-convidante" }] });
      await requisicaoB.promise;
    });
    await waitFor(() => {
      expect(screen.getByTestId("organizacoes")).toHaveTextContent("org-antiga,org-convidante");
      expect(screen.getByTestId("carregando")).toHaveTextContent("false");
    });

    await act(async () => {
      requisicaoA.resolve({ data: [{ id: "org-antiga" }] });
      await requisicaoA.promise;
    });

    expect(screen.getByTestId("organizacoes")).toHaveTextContent("org-antiga,org-convidante");
    expect(screen.getByTestId("carregando")).toHaveTextContent("false");
  });
});
