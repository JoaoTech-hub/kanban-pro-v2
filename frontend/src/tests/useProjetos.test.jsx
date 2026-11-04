import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjetos } from "../hooks/useProjetos";
import { ToastProvider } from "../context/ToastContext";
import api from "../services/api";

// A chamada real de API não deve rodar em teste de hook — controlamos
// exatamente o que cada teste retorna.
vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const ORG_ID = "org-123";
const CHAVE_LOCALSTORAGE = `projetoAtivo:${ORG_ID}`;

// useProjetos usa useToast() internamente (para o feedback de exclusão),
// então todo renderHook precisa estar dentro de um ToastProvider real.
function wrapper({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// Constrói uma resposta no formato REAL da listagem paginada de projetos
// ({ dados, meta }) — usado explicitamente nos testes que precisam
// exercitar o contrato de paginação de verdade (Fase E / 7.4), em vez do
// array bruto (fallback legado, mantido em useProjetos.js por segurança —
// ver comentário lá).
function respostaPaginada(dados, metaOverrides = {}) {
  return {
    data: {
      dados,
      meta: {
        pagina: 1,
        limite: 20,
        total: dados.length,
        totalPaginas: 1,
        ...metaOverrides,
      },
    },
  };
}

describe("useProjetos", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.delete.mockReset();
    api.patch.mockReset();
    localStorage.clear();
  });

  test("carrega a lista de projetos e ativa o primeiro quando não há nada salvo", async () => {
    // Formato real do backend (Fase E / 7.4): { dados, meta } — exercitando
    // o contrato de verdade, não o array bruto do fallback.
    api.get.mockResolvedValueOnce(
      respostaPaginada([
        { id: "p1", name: "Projeto 1" },
        { id: "p2", name: "Projeto 2" },
      ])
    );

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.projetos).toHaveLength(2);
    expect(result.current.projectId).toBe("p1");
    expect(result.current.carregando).toBe(false);
    expect(result.current.erro).toBeNull();
    // O projeto ativo escolhido também é persistido, para sobreviver a um reload.
    expect(localStorage.getItem(CHAVE_LOCALSTORAGE)).toBe("p1");
  });

  test("cria automaticamente o projeto padrão quando a organização não tem nenhum", async () => {
    api.get.mockResolvedValueOnce({ data: [] });
    api.post.mockResolvedValueOnce({ data: { id: "p-novo", name: "Meu Quadro" } });

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(api.post).toHaveBeenCalledWith(`/organizations/${ORG_ID}/projects`, {
      name: "Meu Quadro",
    });
    expect(result.current.projetos).toEqual([{ id: "p-novo", name: "Meu Quadro" }]);
    expect(result.current.projectId).toBe("p-novo");
  });

  test("restaura o projeto salvo no localStorage se ele ainda existir na lista", async () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE, "p2");
    api.get.mockResolvedValueOnce({
      data: [
        { id: "p1", name: "Projeto 1" },
        { id: "p2", name: "Projeto 2" },
      ],
    });

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.projectId).toBe("p2");
  });

  test("cai para o primeiro projeto se o salvo no localStorage não existir mais na lista", async () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE, "projeto-que-foi-excluido");
    api.get.mockResolvedValueOnce({
      data: [{ id: "p1", name: "Projeto 1" }],
    });

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.projectId).toBe("p1");
    expect(localStorage.getItem(CHAVE_LOCALSTORAGE)).toBe("p1");
  });

  test("chama aoOrganizacaoInvalida em vez de setar erro quando a API responde 403", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 403 } });
    const aoOrganizacaoInvalida = vi.fn();

    const { result } = renderHook(() => useProjetos(ORG_ID, aoOrganizacaoInvalida), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(aoOrganizacaoInvalida).toHaveBeenCalledTimes(1);
    expect(result.current.erro).toBeNull();
  });

  test("chama aoOrganizacaoInvalida quando a API responde 404", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    const aoOrganizacaoInvalida = vi.fn();

    const { result } = renderHook(() => useProjetos(ORG_ID, aoOrganizacaoInvalida), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(aoOrganizacaoInvalida).toHaveBeenCalledTimes(1);
  });

  test("define uma mensagem de erro amigável para falhas que não são 403/404", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 500 } });
    const aoOrganizacaoInvalida = vi.fn();

    const { result } = renderHook(() => useProjetos(ORG_ID, aoOrganizacaoInvalida), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(aoOrganizacaoInvalida).not.toHaveBeenCalled();
    expect(result.current.erro).toBe("Não foi possível carregar seus quadros.");
    expect(result.current.carregando).toBe(false);
  });

  test("carregar() não faz nada quando organizationId está vazio", async () => {
    const { result } = renderHook(() => useProjetos(null), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.carregando).toBe(false);
  });

  test("carregamento desabilitado intencionalmente termina sem chamar a API", async () => {
    const { result } = renderHook(() => useProjetos(ORG_ID, undefined, false), { wrapper });

    expect(result.current.carregando).toBe(false);

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.carregando).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  test("criarProjeto envia name e type, adiciona à lista e seleciona o novo projeto", async () => {
    api.get.mockResolvedValueOnce({ data: [{ id: "p1", name: "Projeto 1" }] });
    api.post.mockResolvedValueOnce({ data: { id: "p2", name: "Projeto Novo" } });

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    await act(async () => {
      await result.current.criarProjeto("Projeto Novo", "app");
    });

    expect(api.post).toHaveBeenCalledWith(`/organizations/${ORG_ID}/projects`, {
      name: "Projeto Novo",
      type: "app",
    });
    expect(result.current.projetos.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result.current.projectId).toBe("p2");
  });

  test("criarProjeto propaga o erro (ex.: limite de plano) em vez de tratá-lo internamente", async () => {
    api.get.mockResolvedValueOnce({ data: [{ id: "p1", name: "Projeto 1" }] });
    const erroLimitePlano = {
      response: { status: 403, data: { erro: "Seu plano atual permite no máximo 10 projetos." } },
    };
    api.post.mockRejectedValueOnce(erroLimitePlano);

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    await expect(
      act(async () => {
        await result.current.criarProjeto("Projeto Extra");
      })
    ).rejects.toEqual(erroLimitePlano);

    // Nem "erro" nem "aoOrganizacaoInvalida" são acionados por criarProjeto —
    // quem chamou (o ProjectSwitcher) decide como exibir esse erro específico.
    expect(result.current.erro).toBeNull();
    expect(result.current.projetos).toHaveLength(1);
  });

  test("selecionarProjeto atualiza o projectId e persiste no localStorage", async () => {
    api.get.mockResolvedValueOnce({
      data: [
        { id: "p1", name: "Projeto 1" },
        { id: "p2", name: "Projeto 2" },
      ],
    });

    const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

    await act(async () => {
      await result.current.carregar();
    });

    act(() => {
      result.current.selecionarProjeto("p2");
    });

    expect(result.current.projectId).toBe("p2");
    expect(localStorage.getItem(CHAVE_LOCALSTORAGE)).toBe("p2");
  });

  describe("renomearProjeto", () => {
    test("atualiza o nome na lista e não mexe no projectId (quadro ativo continua o mesmo)", async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { id: "p1", name: "Projeto 1" },
          { id: "p2", name: "Projeto 2" },
        ],
      });
      api.patch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      let sucesso;
      await act(async () => {
        sucesso = await result.current.renomearProjeto("p1", "Projeto 1 Renomeado");
      });

      expect(sucesso).toBe(true);
      expect(api.patch).toHaveBeenCalledWith(`/organizations/${ORG_ID}/projects/p1`, {
        name: "Projeto 1 Renomeado",
      });
      expect(result.current.projetos.find((p) => p.id === "p1").name).toBe(
        "Projeto 1 Renomeado"
      );
      // O projeto ativo continua sendo "p1" — renomear não troca a seleção.
      expect(result.current.projectId).toBe("p1");
    });

    test("em caso de falha da API, desfaz a mudança otimista de nome", async () => {
      api.get.mockResolvedValueOnce({ data: [{ id: "p1", name: "Nome Original" }] });
      api.patch.mockRejectedValueOnce({
        response: { data: { erro: "Apenas owner ou admin podem realizar esta ação" } },
      });

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      let sucesso;
      await act(async () => {
        sucesso = await result.current.renomearProjeto("p1", "Nome Que Não Deveria Ficar");
      });

      expect(sucesso).toBe(false);
      expect(result.current.projetos.find((p) => p.id === "p1").name).toBe("Nome Original");
    });
  });

  describe("atualizarFundoProjeto", () => {
    test("atualiza o background na lista de projetos e persiste na API", async () => {
      api.get.mockResolvedValueOnce({
        data: [{ id: "p1", name: "Projeto 1", background: null }],
      });
      api.patch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      let sucesso;
      await act(async () => {
        sucesso = await result.current.atualizarFundoProjeto("p1", "oceano");
      });

      expect(sucesso).toBe(true);
      expect(api.patch).toHaveBeenCalledWith(
        `/organizations/${ORG_ID}/projects/p1/background`,
        { background: "oceano" }
      );
      expect(result.current.projetos.find((p) => p.id === "p1").background).toBe("oceano");
    });

    test("aceita `null` pra voltar ao fundo padrão", async () => {
      api.get.mockResolvedValueOnce({
        data: [{ id: "p1", name: "Projeto 1", background: "vinho" }],
      });
      api.patch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      await act(async () => {
        await result.current.atualizarFundoProjeto("p1", null);
      });

      expect(api.patch).toHaveBeenCalledWith(
        `/organizations/${ORG_ID}/projects/p1/background`,
        { background: null }
      );
      expect(result.current.projetos.find((p) => p.id === "p1").background).toBeNull();
    });

    test("em caso de falha da API, desfaz a mudança otimista de fundo", async () => {
      api.get.mockResolvedValueOnce({
        data: [{ id: "p1", name: "Projeto 1", background: null }],
      });
      api.patch.mockRejectedValueOnce({
        response: { data: { erro: "Erro ao alterar o fundo do quadro." } },
      });

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      let sucesso;
      await act(async () => {
        sucesso = await result.current.atualizarFundoProjeto("p1", "vinho");
      });

      expect(sucesso).toBe(false);
      // Rollback: volta pro valor de antes da tentativa (null).
      expect(result.current.projetos.find((p) => p.id === "p1").background).toBeNull();
    });

    test("não mexe no background de outros projetos da lista", async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { id: "p1", name: "Projeto 1", background: null },
          { id: "p2", name: "Projeto 2", background: "ceu" },
        ],
      });
      api.patch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      await act(async () => {
        await result.current.atualizarFundoProjeto("p1", "floresta");
      });

      expect(result.current.projetos.find((p) => p.id === "p1").background).toBe("floresta");
      expect(result.current.projetos.find((p) => p.id === "p2").background).toBe("ceu");
    });
  });

  describe("excluirProjeto", () => {
    test("remove da lista e mantém o projeto ativo quando não era o excluído", async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { id: "p1", name: "Projeto 1" },
          { id: "p2", name: "Projeto 2" },
        ],
      });
      api.delete.mockResolvedValueOnce({});

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      let sucesso;
      await act(async () => {
        sucesso = await result.current.excluirProjeto("p2");
      });

      expect(sucesso).toBe(true);
      expect(api.delete).toHaveBeenCalledWith(`/organizations/${ORG_ID}/projects/p2`);
      expect(result.current.projetos.map((p) => p.id)).toEqual(["p1"]);
      expect(result.current.projectId).toBe("p1"); // não mudou, já era o ativo
    });

    test("ao excluir o projeto ativo, seleciona automaticamente outro da lista", async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { id: "p1", name: "Projeto 1" },
          { id: "p2", name: "Projeto 2" },
        ],
      });
      api.delete.mockResolvedValueOnce({});

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });
      // "p1" é o ativo (primeiro da lista, sem nada salvo no localStorage).

      await act(async () => {
        await result.current.excluirProjeto("p1");
      });

      expect(result.current.projetos.map((p) => p.id)).toEqual(["p2"]);
      expect(result.current.projectId).toBe("p2");
      expect(localStorage.getItem(CHAVE_LOCALSTORAGE)).toBe("p2");
    });

    test("ao excluir o único projeto, reprovisiona o projeto padrão automaticamente", async () => {
      api.get.mockResolvedValueOnce({ data: [{ id: "p1", name: "Meu Quadro" }] });
      api.delete.mockResolvedValueOnce({});
      // Segunda chamada a GET (disparada por carregar() dentro de excluirProjeto)
      // encontra a organização vazia de novo, e o hook recria o padrão.
      api.get.mockResolvedValueOnce({ data: [] });
      api.post.mockResolvedValueOnce({ data: { id: "p-novo", name: "Meu Quadro" } });

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      await act(async () => {
        await result.current.excluirProjeto("p1");
      });

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(result.current.projetos).toEqual([{ id: "p-novo", name: "Meu Quadro" }]);
      expect(result.current.projectId).toBe("p-novo");
    });

    test("em caso de falha da API, desfaz a remoção otimista e mantém o projeto ativo original", async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { id: "p1", name: "Projeto 1" },
          { id: "p2", name: "Projeto 2" },
        ],
      });
      api.delete.mockRejectedValueOnce({
        response: { data: { erro: "Apenas owner ou admin podem realizar esta ação" } },
      });

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      let sucesso;
      await act(async () => {
        sucesso = await result.current.excluirProjeto("p1");
      });

      expect(sucesso).toBe(false);
      // Rollback: a lista volta a ter os 2 projetos, e o ativo continua o mesmo.
      expect(result.current.projetos.map((p) => p.id)).toEqual(["p1", "p2"]);
      expect(result.current.projectId).toBe("p1");
    });
  });

  describe("Fase D / 7.3 — projectId nunca vaza de uma organização pra outra", () => {
    test("ao mudar organizationId, projectId é resetado IMEDIATAMENTE (mesmo antes de qualquer fetch) — nunca continua com o valor da organização anterior", () => {
      localStorage.setItem("projetoAtivo:org-A", "proj-A");
      localStorage.setItem("projetoAtivo:org-B", "proj-B");
      api.get.mockResolvedValue({ data: [] });

      const { result, rerender } = renderHook(
        ({ orgId }) => useProjetos(orgId, () => {}),
        { wrapper, initialProps: { orgId: "org-A" } }
      );

      expect(result.current.projectId).toBe("proj-A");

      rerender({ orgId: "org-B" });

      // Verificação síncrona, sem nenhum await/waitFor: no exato próximo
      // render depois da mudança de organizationId, projectId já não pode
      // mais ser o da organização anterior. Se essa correção dependesse de
      // um useEffect (que só roda depois do commit), este assert pegaria
      // "proj-A" aqui, porque a correção ainda não teria acontecido.
      expect(result.current.projectId).not.toBe("proj-A");
      expect(result.current.projectId).toBe("proj-B");
    });

    test("se a nova organização não tem projeto salvo, projectId vira null (nunca o da organização anterior)", () => {
      localStorage.setItem("projetoAtivo:org-A", "proj-A");
      api.get.mockResolvedValue({ data: [] });

      const { result, rerender } = renderHook(
        ({ orgId }) => useProjetos(orgId, () => {}),
        { wrapper, initialProps: { orgId: "org-A" } }
      );
      expect(result.current.projectId).toBe("proj-A");

      rerender({ orgId: "org-C" }); // org-C nunca teve nada salvo

      expect(result.current.projectId).toBeNull();
    });

    test("depois do reset, carregar() confirma/corrige projectId contra a lista real da nova organização normalmente", async () => {
      localStorage.setItem("projetoAtivo:org-A", "proj-A");
      // org-B tem um projeto salvo que corresponde à lista real devolvida pela API.
      localStorage.setItem("projetoAtivo:org-B", "proj-B");
      api.get.mockResolvedValue({ data: [{ id: "proj-B", name: "Quadro B" }] });

      const { result, rerender } = renderHook(
        ({ orgId }) => useProjetos(orgId, () => {}),
        { wrapper, initialProps: { orgId: "org-A" } }
      );

      rerender({ orgId: "org-B" });
      expect(result.current.projectId).toBe("proj-B"); // já correto, antes mesmo do fetch

      await act(async () => {
        await result.current.carregar();
      });

      // carregar() confirma o valor contra a lista real — nada muda, porque
      // já estava certo, e o carregamento termina normalmente.
      expect(result.current.projectId).toBe("proj-B");
      expect(result.current.projetos.map((p) => p.id)).toEqual(["proj-B"]);
      expect(result.current.carregando).toBe(false);
    });
  });

  describe("Fase E / 7.4 — paginação automática de projetos", () => {
    test("quando meta.totalPaginas é 1, não faz nenhuma requisição extra além da página 1", async () => {
      api.get.mockResolvedValueOnce(
        respostaPaginada([{ id: "p1", name: "Projeto 1" }], { totalPaginas: 1, total: 1 })
      );

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(result.current.projetos).toHaveLength(1);
    });

    test(
      "quando meta.totalPaginas > 1, busca automaticamente as páginas seguintes, junta tudo numa lista única, sem perder nenhum projeto e mantendo a ordem recebida",
      async () => {
        const paginaUm = [
          { id: "p1", name: "Projeto 1" },
          { id: "p2", name: "Projeto 2" },
        ];
        const paginaDois = [
          { id: "p3", name: "Projeto 3" },
          { id: "p4", name: "Projeto 4" },
        ];
        const paginaTres = [{ id: "p5", name: "Projeto 5" }];

        api.get.mockImplementation((url, config) => {
          const pagina = config?.params?.pagina ?? 1;
          if (pagina === 1) {
            return Promise.resolve(
              respostaPaginada(paginaUm, { pagina: 1, limite: 2, total: 5, totalPaginas: 3 })
            );
          }
          if (pagina === 2) {
            return Promise.resolve(
              respostaPaginada(paginaDois, { pagina: 2, limite: 2, total: 5, totalPaginas: 3 })
            );
          }
          if (pagina === 3) {
            return Promise.resolve(
              respostaPaginada(paginaTres, { pagina: 3, limite: 2, total: 5, totalPaginas: 3 })
            );
          }
          return Promise.reject(new Error(`página inesperada: ${pagina}`));
        });

        const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

        await act(async () => {
          await result.current.carregar();
        });

        // A 1ª requisição busca a página 1 — sem params explícitos, é o
        // comportamento padrão do backend (pagina=1, limite=20 por default).
        expect(api.get).toHaveBeenNthCalledWith(1, `/organizations/${ORG_ID}/projects`);

        // As páginas seguintes são buscadas com os params corretos, usando
        // o `limite` que veio no meta da 1ª resposta — não um valor
        // hardcoded no frontend.
        expect(api.get).toHaveBeenCalledWith(`/organizations/${ORG_ID}/projects`, {
          params: { pagina: 2, limite: 2 },
        });
        expect(api.get).toHaveBeenCalledWith(`/organizations/${ORG_ID}/projects`, {
          params: { pagina: 3, limite: 2 },
        });
        expect(api.get).toHaveBeenCalledTimes(3);

        // Todos os 5 projetos das 3 páginas terminam reunidos numa lista
        // única — nenhum se perde — na mesma ordem em que as páginas foram
        // recebidas (1, depois 2, depois 3). Para quem consome (ex.:
        // ProjectSwitcher), `projetos` continua sendo uma lista só, sem
        // nenhuma paginação visível.
        expect(result.current.projetos.map((p) => p.id)).toEqual([
          "p1",
          "p2",
          "p3",
          "p4",
          "p5",
        ]);
        expect(result.current.projetos).toHaveLength(5);
        expect(result.current.projectId).toBe("p1"); // primeiro da lista, sem nada salvo
      }
    );

    test("a paginação automática não interfere no fluxo de organização vazia (o projeto padrão continua sendo criado normalmente)", async () => {
      api.get.mockResolvedValueOnce(respostaPaginada([], { total: 0, totalPaginas: 1 }));
      api.post.mockResolvedValueOnce({ data: { id: "p-novo", name: "Meu Quadro" } });

      const { result } = renderHook(() => useProjetos(ORG_ID), { wrapper });

      await act(async () => {
        await result.current.carregar();
      });

      expect(api.get).toHaveBeenCalledTimes(1); // nenhuma página extra buscada
      expect(result.current.projetos).toEqual([{ id: "p-novo", name: "Meu Quadro" }]);
    });
  });
});
