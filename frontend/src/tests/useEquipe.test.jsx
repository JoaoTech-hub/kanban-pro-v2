import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEquipe } from "../hooks/useEquipe";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider } from "../context/AuthContext";
import { OrganizationsProvider } from "../context/OrganizationsContext";
import api from "../services/api";

// A chamada real de API não deve rodar em teste de hook — controlamos
// exatamente o que cada teste retorna.
vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const ORG_ID = "org-123";

// useEquipe usa useToast() (feedback de cada ação) e useOrganizacoes(), que
// por sua vez depende de OrganizationsContext -> AuthContext (token) ->
// react-router (useNavigate) — por isso a árvore completa de providers,
// mesmo padrão já usado nos testes de troca de organização do KanbanContext.
function wrapper({ children }) {
  return (
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <OrganizationsProvider>{children}</OrganizationsProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function membro(userId, nome, role) {
  return { userId, nome, email: `${nome.toLowerCase()}@teste.com`, role };
}

function convite(id, email, role) {
  return { id, email, role, invitedBy: { name: "Quem Convidou" } };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("nome", "Fulano");
  localStorage.setItem("organizationId", ORG_ID);

  // OrganizationsProvider busca a lista de organizações assim que monta
  // (depende de `token`) — mockado aqui pra não gerar chamada não tratada
  // em todo teste, mesmo quando o teste em si só se importa com useEquipe.
  api.get.mockImplementation((url) => {
    if (url === "/organizations") {
      return Promise.resolve({ data: [{ id: ORG_ID, name: "Minha Org", role: "owner", plan: "free" }] });
    }
    return Promise.resolve({ data: [] });
  });
});

describe("useEquipe — carregar", () => {
  test("busca membros e convites em paralelo e preenche o estado", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/organizations") {
        return Promise.resolve({ data: [{ id: ORG_ID, name: "Minha Org", role: "owner" }] });
      }
      if (url === `/organizations/${ORG_ID}/members`) {
        return Promise.resolve({ data: [membro("u1", "Ana", "owner"), membro("u2", "Bruno", "member")] });
      }
      if (url === `/organizations/${ORG_ID}/invites`) {
        return Promise.resolve({ data: [convite("c1", "pendente@teste.com", "member")] });
      }
      return Promise.resolve({ data: [] });
    });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.membros).toHaveLength(2);
    expect(result.current.convites).toHaveLength(1);
    expect(result.current.carregando).toBe(false);

    expect(api.get).toHaveBeenCalledWith(`/organizations/${ORG_ID}/members`);
    expect(api.get).toHaveBeenCalledWith(`/organizations/${ORG_ID}/invites`);
  });

  test("em caso de falha, mostra toast de erro e carregando termina em false", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/organizations") return Promise.resolve({ data: [] });
      if (url.includes("/members") || url.includes("/invites")) {
        return Promise.reject(new Error("falha de rede"));
      }
      return Promise.resolve({ data: [] });
    });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.carregando).toBe(false);
    await waitFor(() => expect(screen.getByText("Não foi possível carregar a equipe.")).toBeInTheDocument());
  });

  test("carregar() não faz nada se organizationId não estiver definido", async () => {
    const { result } = renderHook(() => useEquipe(null), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    const chamadasMembros = api.get.mock.calls.filter(([url]) => url?.includes("/members"));
    expect(chamadasMembros).toHaveLength(0);
  });
});

describe("useEquipe — convidar", () => {
  test("envia o payload correto, mostra toast de sucesso e recarrega a equipe", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/organizations") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    api.post.mockResolvedValue({ data: { id: "novo-convite" } });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    let retorno;
    await act(async () => {
      retorno = await result.current.convidar("gente@teste.com", "admin");
    });

    expect(retorno).toBe(true);
    expect(api.post).toHaveBeenCalledWith(`/organizations/${ORG_ID}/invites`, {
      email: "gente@teste.com",
      role: "admin",
    });
    await waitFor(() =>
      expect(screen.getByText("Convite enviado para gente@teste.com.")).toBeInTheDocument()
    );
    // Recarrega a equipe depois do convite — /invites chamado de novo.
    const chamadasInvites = api.get.mock.calls.filter(([url]) => url === `/organizations/${ORG_ID}/invites`);
    expect(chamadasInvites.length).toBeGreaterThan(0);
  });

  test("em caso de falha, mostra a mensagem de erro do backend, não recarrega, e retorna false", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockRejectedValue({ response: { data: { erro: "Este e-mail já pertence à organização" } } });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    let retorno;
    await act(async () => {
      retorno = await result.current.convidar("jamembro@teste.com", "member");
    });

    expect(retorno).toBe(false);
    await waitFor(() =>
      expect(screen.getByText("Este e-mail já pertence à organização")).toBeInTheDocument()
    );
    // Sem recarregar: só a chamada de /invites feita pelo próprio POST,
    // nenhuma chamada de GET /invites disparada em seguida.
    const chamadasGetInvites = api.get.mock.calls.filter(([url]) => url === `/organizations/${ORG_ID}/invites`);
    expect(chamadasGetInvites).toHaveLength(0);
  });
});

describe("useEquipe — revogarConvite", () => {
  test("revoga com sucesso, mostra toast e recarrega", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.delete.mockResolvedValue({});

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.revogarConvite("convite-1");
    });

    expect(api.delete).toHaveBeenCalledWith(`/organizations/${ORG_ID}/invites/convite-1`);
    await waitFor(() => expect(screen.getByText("Convite revogado.")).toBeInTheDocument());
  });

  test("em caso de falha, mostra toast de erro genérico", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.delete.mockRejectedValue(new Error("falhou"));

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.revogarConvite("convite-1");
    });

    await waitFor(() =>
      expect(screen.getByText("Não foi possível revogar o convite.")).toBeInTheDocument()
    );
  });
});

describe("useEquipe — alterarRole", () => {
  test("altera com sucesso, mostra toast e recarrega", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.patch.mockResolvedValue({});

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.alterarRole("user-1", "admin");
    });

    expect(api.patch).toHaveBeenCalledWith(`/organizations/${ORG_ID}/members/user-1`, { role: "admin" });
    await waitFor(() => expect(screen.getByText("Papel do membro atualizado.")).toBeInTheDocument());
  });

  test("em caso de falha, mostra a mensagem de erro do backend (ex.: 403 de autorização)", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.patch.mockRejectedValue({
      response: { data: { erro: "Apenas o owner pode gerenciar administradores." } },
    });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.alterarRole("user-1", "member");
    });

    await waitFor(() =>
      expect(screen.getByText("Apenas o owner pode gerenciar administradores.")).toBeInTheDocument()
    );
  });
});

describe("useEquipe — removerMembro", () => {
  test("remove com sucesso, mostra toast e recarrega", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.delete.mockResolvedValue({});

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.removerMembro("user-2");
    });

    expect(api.delete).toHaveBeenCalledWith(`/organizations/${ORG_ID}/members/user-2`);
    await waitFor(() => expect(screen.getByText("Membro removido da organização.")).toBeInTheDocument());
  });

  test("em caso de falha, mostra a mensagem de erro do backend (ex.: 409 auto-remoção)", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.delete.mockRejectedValue({
      response: { data: { erro: "Você não pode remover a si mesmo por aqui." } },
    });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.removerMembro("user-1");
    });

    await waitFor(() =>
      expect(screen.getByText("Você não pode remover a si mesmo por aqui.")).toBeInTheDocument()
    );
  });
});

describe("useEquipe — transferirOwnership", () => {
  test("envia o payload correto, mostra toast de sucesso, recarrega equipe E a lista de organizações, retorna true", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/organizations") return Promise.resolve({ data: [{ id: ORG_ID, name: "Minha Org" }] });
      return Promise.resolve({ data: [] });
    });
    api.post.mockResolvedValue({});

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    // Espera o carregamento inicial do OrganizationsProvider terminar antes
    // de zerar a contagem de chamadas — só queremos contar as que
    // acontecem DEPOIS da transferência.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/organizations"));
    api.get.mockClear();

    let retorno;
    await act(async () => {
      retorno = await result.current.transferirOwnership("user-2");
    });

    expect(retorno).toBe(true);
    expect(api.post).toHaveBeenCalledWith(
      `/organizations/${ORG_ID}/members/transfer-ownership`,
      { novoOwnerUserId: "user-2" }
    );
    await waitFor(() =>
      expect(screen.getByText("Propriedade da organização transferida.")).toBeInTheDocument()
    );

    // As duas fontes de dados são recarregadas: a equipe (membros muda de
    // role) E a lista de organizações do OrganizationsContext (o role do
    // usuário logado na organização também muda).
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/organizations/${ORG_ID}/members`);
      expect(api.get).toHaveBeenCalledWith("/organizations");
    });
  });

  test("em caso de falha, mostra a mensagem de erro do backend e retorna false", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockRejectedValue({
      response: { data: { erro: "Apenas o owner pode transferir a propriedade." } },
    });

    const { result } = renderHook(() => useEquipe(ORG_ID), { wrapper });

    let retorno;
    await act(async () => {
      retorno = await result.current.transferirOwnership("user-2");
    });

    expect(retorno).toBe(false);
    await waitFor(() =>
      expect(screen.getByText("Apenas o owner pode transferir a propriedade.")).toBeInTheDocument()
    );
  });
});