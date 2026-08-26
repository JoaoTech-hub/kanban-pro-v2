import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../services/api";
import App from "../App";

vi.mock("../services/api");

function membrosFixture() {
  return [
    { userId: "u-owner", nome: "Ana Owner", email: "ana@teste.com", role: "owner" },
    { userId: "u-admin", nome: "Bruno Admin", email: "bruno@teste.com", role: "admin" },
    { userId: "u-member", nome: "Carlos Member", email: "carlos@teste.com", role: "member" },
  ];
}

// `meuRole` simula o papel do usuário LOGADO na organização (o que
// determina o que a UI mostra/esconde) — independente dos papéis dos
// outros membros na lista, que vêm de uma fonte separada (/members).
function mockApi(meuRole, overrides = {}) {
  api.get.mockImplementation((url) => {
    if (url === "/organizations") {
      return Promise.resolve({
        data: [{ id: "org-1", name: "Minha Organização", role: meuRole, plan: "free" }],
      });
    }
    if (url === "/organizations/org-1/members") {
      return Promise.resolve({ data: overrides.membros ?? membrosFixture() });
    }
    if (url === "/organizations/org-1/invites") {
      return Promise.resolve({ data: overrides.convites ?? [] });
    }
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: {} });
  api.patch.mockResolvedValue({});
  api.delete.mockResolvedValue({});
}

function renderEquipe() {
  return render(
    <MemoryRouter initialEntries={["/equipe"]}>
      <App />
    </MemoryRouter>
  );
}

async function aguardarCarregar() {
  await waitFor(() => expect(screen.getByText("Ana Owner")).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("nome", "Fulano");
  localStorage.setItem("organizationId", "org-1");
});

describe("Equipe — renderização de membros e matriz de autorização (owner/admin/member)", () => {
  test("owner: consegue gerenciar admin e member, mas não vê controle de gestão pra si mesmo", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    // 1 select do formulário de convite + 1 select por membro GERENCIÁVEL
    // (Bruno-admin e Carlos-member — nunca o próprio owner, Ana).
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(3);
  });

  test("admin: consegue gerenciar member, mas NÃO outro admin nem o owner", async () => {
    mockApi("admin");
    renderEquipe();
    await aguardarCarregar();

    // 1 select do formulário de convite (admin pode convidar, só não como
    // "admin") + 1 select só pra Carlos (member) — nada pra Ana nem Bruno.
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(2);
  });

  test("member: não vê nenhum controle de gestão, nem formulário de convite, nem seção de convites pendentes", async () => {
    mockApi("member", { convites: [{ id: "c1", email: "pendente@teste.com", role: "member", invitedBy: { name: "Ana" } }] });
    renderEquipe();
    await aguardarCarregar();

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText("Convidar novo membro")).not.toBeInTheDocument();
    expect(screen.queryByText(/Convites pendentes/)).not.toBeInTheDocument();
  });

  test("opção 'Admin' no formulário de convite aparece pro owner", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();
    const selectConviteOwner = screen.getAllByRole("combobox")[0];
    expect(within(selectConviteOwner).getByText("Admin")).toBeInTheDocument();
  });

  test("opção 'Admin' no formulário de convite NÃO aparece pro admin", async () => {
    mockApi("admin");
    renderEquipe();
    await aguardarCarregar();
    const selectConviteAdmin = screen.getAllByRole("combobox")[0];
    expect(within(selectConviteAdmin).queryByText("Admin")).not.toBeInTheDocument();
  });

  test("mostra 'Nenhum membro ainda' só depois do primeiro carregamento, quando a lista está vazia", async () => {
    mockApi("owner", { membros: [] });
    renderEquipe();

    await waitFor(() => expect(screen.getByText("Nenhum membro ainda.")).toBeInTheDocument());
  });
});

describe("Equipe — convidar membro", () => {
  test("envia o convite com sucesso e limpa o formulário", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    const emailInput = screen.getByPlaceholderText("E-mail da pessoa a convidar");
    fireEvent.change(emailInput, { target: { value: "novo@teste.com" } });
    fireEvent.click(screen.getByText("Convidar"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/organizations/org-1/invites", {
        email: "novo@teste.com",
        role: "member",
      })
    );
    await waitFor(() => expect(emailInput.value).toBe(""));
  });

  test("convite com falha mantém o e-mail preenchido no formulário", async () => {
    mockApi("owner");
    api.post.mockRejectedValue({ response: { data: { erro: "Este e-mail já pertence à organização" } } });
    renderEquipe();
    await aguardarCarregar();

    const emailInput = screen.getByPlaceholderText("E-mail da pessoa a convidar");
    fireEvent.change(emailInput, { target: { value: "jamembro@teste.com" } });
    fireEvent.click(screen.getByText("Convidar"));

    await waitFor(() =>
      expect(screen.getByText("Este e-mail já pertence à organização")).toBeInTheDocument()
    );
    expect(emailInput.value).toBe("jamembro@teste.com");
  });
});

describe("Equipe — alterar papel de um membro", () => {
  test("selecionar 'Owner' no papel de um membro abre a confirmação de transferência, sem chamar alterarRole", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    // comboboxes[0] = formulário de convite; [1] = Bruno (admin); [2] = Carlos (member).
    const selectDoBruno = screen.getAllByRole("combobox")[1];
    fireEvent.change(selectDoBruno, { target: { value: "owner" } });

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Transferir propriedade da organização?")).toBeInTheDocument();
    expect(within(dialogo).getByText(/Bruno Admin/)).toBeInTheDocument();

    // Nenhuma chamada de alterarRole (PATCH /members/:id) foi disparada
    // só por escolher "Owner" — a troca de papel real só acontece se a
    // transferência for confirmada.
    expect(api.patch).not.toHaveBeenCalled();
  });

  test("confirmar a transferência chama transferirOwnership com o membro certo", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    const selectDoBruno = screen.getAllByRole("combobox")[1];
    fireEvent.change(selectDoBruno, { target: { value: "owner" } });

    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByText("Transferir"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/organizations/org-1/members/transfer-ownership", {
        novoOwnerUserId: "u-admin",
      })
    );
  });

  test("selecionar 'Member' num membro chama alterarRole diretamente (sem confirmação)", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    const selectDoBruno = screen.getAllByRole("combobox")[1]; // Bruno é admin
    fireEvent.change(selectDoBruno, { target: { value: "member" } });

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/organizations/org-1/members/u-admin", { role: "member" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Equipe — remover membro", () => {
  test("remover membro chama a API diretamente, sem modal de confirmação", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    // Botões de remover são ícone-somente (sem texto) — filtra pelos
    // botões sem conteúdo textual, que são os "lixeira" de cada linha
    // gerenciável (2 quando logado como owner: Bruno e Carlos).
    const botoesRemover = screen.getAllByRole("button").filter((b) => b.textContent.trim() === "");
    expect(botoesRemover).toHaveLength(2);

    fireEvent.click(botoesRemover[0]);

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(`/organizations/org-1/members/${membrosFixture()[1].userId}`)
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Equipe — renomear organização", () => {
  test("owner vê o formulário e consegue renomear", async () => {
    mockApi("owner");
    api.patch.mockResolvedValue({ data: { name: "Nome Alterado" } });
    renderEquipe();
    await aguardarCarregar();

    const secaoNome = screen.getByText("Nome da organização").closest("div");
    const input = within(secaoNome).getByDisplayValue("Minha Organização");
    fireEvent.change(input, { target: { value: "Nome Alterado" } });
    fireEvent.click(within(secaoNome).getByText("Salvar"));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/organizations/org-1", { name: "Nome Alterado" })
    );
  });

  test("admin NÃO vê o formulário de renomear — só um texto informativo", async () => {
    mockApi("admin");
    renderEquipe();
    await aguardarCarregar();

    expect(screen.getByText(/somente o owner pode alterar/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Minha Organização")).not.toBeInTheDocument();
  });

  test("botão salvar fica desabilitado quando o nome não muda", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    const secaoNome = screen.getByText("Nome da organização").closest("div");
    expect(within(secaoNome).getByText("Salvar")).toBeDisabled();
  });
});

describe("Equipe — sair da organização", () => {
  test("owner não consegue sair (botão desabilitado) e vê o motivo", async () => {
    mockApi("owner");
    renderEquipe();
    await aguardarCarregar();

    expect(screen.getByText("Sair")).toBeDisabled();
    expect(screen.getByText(/transfira a propriedade antes de sair/)).toBeInTheDocument();
  });

  test("member consegue sair — confirmação chama a API e troca de organização", async () => {
    mockApi("member");
    api.get.mockImplementation((url) => {
      if (url === "/organizations") {
        return Promise.resolve({
          data: [
            { id: "org-1", name: "Minha Organização", role: "member", plan: "free" },
            { id: "org-2", name: "Outra Organização", role: "member", plan: "free" },
          ],
        });
      }
      if (url === "/organizations/org-1/members") return Promise.resolve({ data: membrosFixture() });
      if (url === "/organizations/org-1/invites") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    // sair() lê resposta.data.organizacoes pra decidir pra qual organização
    // trocar em seguida — precisa vir populado, senão o próprio código da
    // página quebraria tentando ler organizacoes[0] de undefined.
    api.delete.mockResolvedValue({
      data: { organizacoes: [{ id: "org-2", name: "Outra Organização", role: "member", plan: "free" }] },
    });

    renderEquipe();
    await aguardarCarregar();

    const botaoSair = screen.getByText("Sair");
    expect(botaoSair).not.toBeDisabled();
    fireEvent.click(botaoSair);

    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByText("Sair"));

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith("/organizations/org-1/members/me")
    );
  });
});