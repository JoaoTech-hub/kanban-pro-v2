import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "../services/api";
import App from "../App";

vi.mock("../services/api");

const TOKEN = "token-do-convite";

function conviteFixture(overrides = {}) {
  return {
    email: "convidado@teste.com",
    role: "member",
    nomeOrganizacao: "Organização Teste",
    nomeConvidante: "Ana Convidante",
    contaExistente: false,
    ...overrides,
  };
}

// Cobre as chamadas que o resto da árvore de Providers (sempre montada,
// mesmo em rotas públicas) pode disparar durante os testes de sucesso —
// login() + carregarOrganizacoes() e, depois de navegar pro dashboard, a
// própria carga do Kanban.
function mockApiPadrao(convite = conviteFixture()) {
  api.get.mockImplementation((url) => {
    if (url === `/convites/${TOKEN}`) return Promise.resolve({ data: convite });
    if (url === "/organizations") {
      return Promise.resolve({ data: [{ id: "org-1", name: "Organização Teste", role: "member", plan: "free" }] });
    }
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: {} });
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={[`/convites/${TOKEN}`]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("AceitarConvite — carregamento do convite", () => {
  test("mostra 'Carregando convite...' enquanto a busca está pendente", async () => {
    let resolver;
    api.get.mockImplementation((url) => {
      if (url === `/convites/${TOKEN}`) return new Promise((r) => { resolver = r; });
      return Promise.resolve({ data: [] });
    });

    renderPagina();

    await waitFor(() => expect(screen.getByText("Carregando convite...")).toBeInTheDocument());

    resolver({ data: conviteFixture() });
    await waitFor(() => expect(screen.queryByText("Carregando convite...")).not.toBeInTheDocument());
  });

  test("convite inválido/expirado mostra a mensagem do backend, sem formulário", async () => {
    api.get.mockImplementation((url) => {
      if (url === `/convites/${TOKEN}`) {
        return Promise.reject({ response: { data: { erro: "Este convite expirou." } } });
      }
      return Promise.resolve({ data: [] });
    });

    renderPagina();

    await waitFor(() => expect(screen.getByText("Este convite expirou.")).toBeInTheDocument());
    expect(screen.getByText("Convite inválido")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Seu nome")).not.toBeInTheDocument();
  });

  test("convite inválido sem mensagem específica do backend usa o texto padrão", async () => {
    api.get.mockImplementation((url) => {
      if (url === `/convites/${TOKEN}`) return Promise.reject(new Error("erro genérico de rede"));
      return Promise.resolve({ data: [] });
    });

    renderPagina();

    await waitFor(() =>
      expect(
        screen.getByText("Este convite é inválido, expirou ou já foi utilizado.")
      ).toBeInTheDocument()
    );
  });

  test("'Ir para o login' navega pro login sem levar nenhum convite no state (fluxo genérico)", async () => {
    api.get.mockImplementation((url) => {
      if (url === `/convites/${TOKEN}`) {
        return Promise.reject({ response: { data: { erro: "Convite não encontrado." } } });
      }
      return Promise.resolve({ data: [] });
    });

    renderPagina();
    await waitFor(() => expect(screen.getByText("Convite não encontrado.")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Ir para o login"));

    await waitFor(() =>
      expect(screen.getByText("Entre para gerenciar suas tarefas")).toBeInTheDocument()
    );
  });
});

describe("AceitarConvite — convite válido, conta nova (contaExistente: false)", () => {
  test("mostra quem convidou, pra qual organização, e o formulário de conta nova", async () => {
    mockApiPadrao();
    renderPagina();

    await waitFor(() =>
      expect(screen.getByText("Ana Convidante te convidou para Organização Teste")).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue("convidado@teste.com")).toBeDisabled();
    expect(screen.getByPlaceholderText("Seu nome")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Crie uma senha")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirmar senha")).toBeInTheDocument();
  });

  test("senhas diferentes mostram erro e não chamam a API", async () => {
    mockApiPadrao();
    renderPagina();
    await waitFor(() => screen.getByPlaceholderText("Seu nome"));

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Convidado" } });
    fireEvent.change(screen.getByPlaceholderText("Crie uma senha"), { target: { value: "senha123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), { target: { value: "outraSenha123" } });
    fireEvent.click(screen.getByText("Criar conta e aceitar convite"));

    await waitFor(() => expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();
  });

  test("senha fraca mostra erro e não chama a API", async () => {
    mockApiPadrao();
    renderPagina();
    await waitFor(() => screen.getByPlaceholderText("Seu nome"));

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Convidado" } });
    fireEvent.change(screen.getByPlaceholderText("Crie uma senha"), { target: { value: "123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), { target: { value: "123" } });
    fireEvent.click(screen.getByText("Criar conta e aceitar convite"));

    await waitFor(() =>
      expect(
        screen.getByText(
          "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número."
        )
      ).toBeInTheDocument()
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  test("sucesso: envia o payload correto, loga, carrega organizações e sai do formulário (navega)", async () => {
    mockApiPadrao();
    api.post.mockResolvedValue({
      data: { token: "novo-jwt", nome: "Convidado", organizationId: "org-1" },
    });
    renderPagina();
    await waitFor(() => screen.getByPlaceholderText("Seu nome"));

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Convidado" } });
    fireEvent.change(screen.getByPlaceholderText("Crie uma senha"), { target: { value: "senha123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByText("Criar conta e aceitar convite"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/convites/${TOKEN}/aceitar-novo`, {
        nome: "Convidado",
        senha: "senha123",
      })
    );

    // login() persiste o token antes de carregarOrganizacoes() rodar —
    // confirma a ordem observando que a lista de organizações É buscada
    // depois do aceite.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/organizations"));
    expect(localStorage.getItem("token")).toBe("novo-jwt");

    // Navegou pra fora da própria tela de aceite.
    await waitFor(() =>
      expect(screen.queryByText("Criar conta e aceitar convite")).not.toBeInTheDocument()
    );
  });

  test("erro no aceite mostra a mensagem do backend e mantém o formulário", async () => {
    mockApiPadrao();
    api.post.mockRejectedValue({ response: { data: { erro: "Este convite já foi utilizado." } } });
    renderPagina();
    await waitFor(() => screen.getByPlaceholderText("Seu nome"));

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Convidado" } });
    fireEvent.change(screen.getByPlaceholderText("Crie uma senha"), { target: { value: "senha123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByText("Criar conta e aceitar convite"));

    await waitFor(() => expect(screen.getByText("Este convite já foi utilizado.")).toBeInTheDocument());
    // Formulário continua ali — não navegou, não perdeu os dados digitados.
    expect(screen.getByPlaceholderText("Seu nome")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("botão mostra 'Aceitando...' e fica desabilitado enquanto envia", async () => {
    mockApiPadrao();
    let resolver;
    api.post.mockReturnValue(new Promise((r) => { resolver = r; }));
    renderPagina();
    await waitFor(() => screen.getByPlaceholderText("Seu nome"));

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "Convidado" } });
    fireEvent.change(screen.getByPlaceholderText("Crie uma senha"), { target: { value: "senha123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirmar senha"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByText("Criar conta e aceitar convite"));

    await waitFor(() => expect(screen.getByText("Aceitando...")).toBeDisabled());

    resolver({ data: { token: "t", nome: "Convidado", organizationId: "org-1" } });
    // Deixa os efeitos disparados pelo resolve (login/carregarOrganizacoes)
    // assentarem antes do teste terminar, evitando ruído de "not wrapped
    // in act(...)" no restante da suíte.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/organizations"));
  });
});

describe("AceitarConvite — convite válido, conta já existente (contaExistente: true)", () => {
  test("mostra a mensagem de conta existente, sem formulário de criar conta", async () => {
    mockApiPadrao(conviteFixture({ contaExistente: true }));
    renderPagina();

    await waitFor(() =>
      expect(screen.getByText(/Já existe uma conta com o e-mail/)).toBeInTheDocument()
    );
    expect(screen.getByText("convidado@teste.com")).toBeInTheDocument();
    expect(screen.getByText("Fazer login para aceitar")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Crie uma senha")).not.toBeInTheDocument();
  });

  test("'Fazer login para aceitar' navega pro login levando o token do convite — sem chamar aceitar-existente diretamente", async () => {
    mockApiPadrao(conviteFixture({ contaExistente: true }));
    renderPagina();
    await waitFor(() => screen.getByText("Fazer login para aceitar"));

    fireEvent.click(screen.getByText("Fazer login para aceitar"));

    // O texto do Login muda quando ele recebe um conviteToken pelo state
    // (ver Login.jsx) — confirma que a navegação levou o token consigo.
    await waitFor(() => expect(screen.getByText("Entre para aceitar o convite")).toBeInTheDocument());

    // Esta página NUNCA chama aceitar-existente — quem faz isso, depois do
    // login, é o Login.jsx (fora do escopo desta página/deste teste).
    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringContaining("aceitar-existente"),
      expect.anything()
    );
  });
});