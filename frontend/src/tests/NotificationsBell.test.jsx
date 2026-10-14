import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import NotificationsBell from "../components/NotificationsBell";
import { lightTheme } from "../styles/theme";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useOrganizationsContext } from "../context/OrganizationsContext";

vi.mock("../services/api", () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/OrganizationsContext", () => ({ useOrganizationsContext: vi.fn() }));

const FIXTURES = [
  { id: "n-1", message: "João aceitou seu convite para Produto.", createdAt: "2026-10-14T10:00:00.000Z", readAt: null },
  { id: "n-2", message: "Notificação antiga.", createdAt: "2026-10-13T10:00:00.000Z", readAt: "2026-10-13T11:00:00.000Z" },
];

function renderBell() {
  return render(<ThemeProvider theme={lightTheme}><NotificationsBell /></ThemeProvider>);
}

describe("NotificationsBell", () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: { notifications: FIXTURES, unreadCount: 1 } });
    api.patch.mockReset().mockResolvedValue({});
    api.post.mockReset();
    useAuth.mockReturnValue({ trocarOrganizacao: vi.fn() });
    useOrganizationsContext.mockReturnValue({ carregar: vi.fn().mockResolvedValue() });
  });

  test("carrega o contador e exibe mensagem, data e estado de leitura no painel", async () => {
    renderBell();
    expect(await screen.findByRole("button", { name: "Notificações, 1 não lidas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notificações, 1 não lidas" }));
    expect(await screen.findByText(FIXTURES[0].message)).toBeInTheDocument();
    expect(screen.getByText("Não lida")).toBeInTheDocument();
    expect(screen.getByText("Lida")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-14T10:00:00.000Z"]')).toBeInTheDocument();
  });

  test("marca uma notificação individualmente como lida", async () => {
    renderBell();
    const trigger = await screen.findByRole("button", { name: "Notificações, 1 não lidas" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como lida" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/notifications/n-1/read"));
    expect(await screen.findByRole("button", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.getAllByText("Lida")).toHaveLength(2);
  });

  test("marca todas as notificações como lidas", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lidas" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar todas como lidas" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/notifications/read-all"));
    expect(await screen.findByRole("button", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como lida" })).not.toBeInTheDocument();
  });

  test("mostra falha ao carregar sem quebrar o cabeçalho", async () => {
    api.get.mockRejectedValueOnce(new Error("offline"));
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notificações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as notificações.");
  });

  test("aceita convite, ativa a organização e recarrega a lista", async () => {
    const convite = {
      id: "invite-notification",
      type: "invite_received",
      message: "Você foi convidado para Produto B.",
      createdAt: "2026-10-14T10:00:00.000Z",
      readAt: null,
      invite: {
        id: "invite-1",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
        organization: { id: "org-b", name: "Produto B" },
      },
    };
    const trocarOrganizacao = vi.fn();
    const carregar = vi.fn().mockResolvedValue();
    useAuth.mockReturnValue({ trocarOrganizacao });
    useOrganizationsContext.mockReturnValue({ carregar });
    api.get.mockResolvedValue({ data: { notifications: [convite], unreadCount: 1 } });
    api.post.mockResolvedValue({ data: { organizationId: "org-b" } });

    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lidas" }));
    expect(await screen.findByText("Organização: Produto B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar convite" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/notifications/invite-notification/accept-invite"));
    await waitFor(() => expect(trocarOrganizacao).toHaveBeenCalledWith("org-b"));
    expect(carregar).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Lida")).toBeInTheDocument();
  });

  test("erro no aceite mantém a organização atual e exibe a mensagem da API", async () => {
    const convite = {
      id: "invite-notification",
      type: "invite_received",
      message: "Você foi convidado para Produto B.",
      createdAt: "2026-10-14T10:00:00.000Z",
      readAt: null,
      invite: {
        id: "invite-1",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
        organization: { id: "org-b", name: "Produto B" },
      },
    };
    const trocarOrganizacao = vi.fn();
    const carregar = vi.fn();
    useAuth.mockReturnValue({ trocarOrganizacao });
    useOrganizationsContext.mockReturnValue({ carregar });
    api.get.mockResolvedValue({ data: { notifications: [convite], unreadCount: 1 } });
    api.post.mockRejectedValue({ response: { data: { erro: "Este convite expirou." } } });

    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lidas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este convite expirou.");
    expect(trocarOrganizacao).not.toHaveBeenCalled();
    expect(carregar).not.toHaveBeenCalled();
  });
});
