import { useState, useCallback } from "react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";

const NOME_PROJETO_PADRAO = "Meu Quadro";

// Segue a mesma convenção de useKanban/useColunas: o hook expõe estado e
// funções, mas não decide sozinho quando buscar dados — quem chama (o
// ProjectContext) é responsável pelo useEffect que dispara `carregar`.
export function useProjetos(organizationId, aoOrganizacaoInvalida) {
  const [projetos, setProjetos] = useState([]);
  // Inicializa com o último projeto ativo salvo (se existir) em vez de
  // `null` — é o mesmo valor que `carregar()` mais tarde confirma/corrige
  // contra a lista real, só que disponível *sincronamente*, sem esperar a
  // rede. Isso permite que o KanbanContext (que depende de `projectId`)
  // comece a buscar colunas/cards em PARALELO com esta própria busca da
  // lista de projetos, em vez de só poder começar depois que ela terminar
  // — colapsando uma cadeia sequencial de 2 requisições em 2 requisições
  // paralelas pra quem já tem um projeto salvo de uma visita anterior.
  // Se o valor salvo não existir mais na lista real, `carregar()` já
  // corrige isso normalmente (mesma lógica de sempre).
  const [projectId, setProjectId] = useState(() =>
    organizationId ? localStorage.getItem(`projetoAtivo:${organizationId}`) : null
  );

  // Ajusta `projectId` DURANTE o render (não num useEffect) quando
  // `organizationId` muda — o padrão oficial do React pra "resetar estado
  // em resposta a uma prop mudar" (docs: "Adjusting state when a prop
  // changes"). Isso garante que NENHUM componente descendente (em
  // particular o KanbanContext, que depende de `projectId`) chega a
  // renderizar sequer uma vez com o `projectId` da organização ANTERIOR
  // depois que `organizationId` já mudou. Se essa correção rodasse só
  // dentro de um useEffect (que só dispara DEPOIS do commit), haveria uma
  // janela real em que o Kanban ainda enxergaria o projectId antigo e
  // dispararia uma busca com uma combinação organização/projeto que nunca
  // existiu — sintoma original da Fase D / 7.3 (um 404 momentâneo seguido
  // de "Falha ao carregar dados" na troca de organização).
  const [organizationIdAnterior, setOrganizationIdAnterior] = useState(organizationId);
  if (organizationId !== organizationIdAnterior) {
    setOrganizationIdAnterior(organizationId);
    setProjectId(organizationId ? localStorage.getItem(`projetoAtivo:${organizationId}`) : null);
  }

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const { showToast } = useToast();

  const carregar = useCallback(async () => {
    if (!organizationId) return;

    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/organizations/${organizationId}/projects`);
      // Extrai o array da chave .dados (novo formato da Fase 6.5) com fallback para array vazio
      let lista = resposta.data.dados || resposta.data || [];

      if (lista.length === 0) {
        // Primeiro acesso: cria o projeto padrão automaticamente, preservando
        // o comportamento que já existia (entrar e já ter um quadro pronto).
        const criado = await api.post(`/organizations/${organizationId}/projects`, {
          name: NOME_PROJETO_PADRAO,
        });
        lista = [criado.data];
      }

      setProjetos(lista);

      // Mantém o projeto ativo escolhido anteriormente (persistido por
      // organização), se ele ainda existir na lista; senão cai no primeiro.
      const chave = `projetoAtivo:${organizationId}`;
      const salvo = localStorage.getItem(chave);
      const idParaUsar = lista.some((p) => p.id === salvo) ? salvo : lista[0].id;
      setProjectId(idParaUsar);
      localStorage.setItem(chave, idParaUsar);
    } catch (e) {
      const status = e.response?.status;

      // organizationId inválido/adulterado só é recuperável com um novo
      // login (ainda não existe seletor de organizações).
      if ((status === 403 || status === 404) && aoOrganizacaoInvalida) {
        aoOrganizacaoInvalida();
        return;
      }

      console.error(e);
      setErro("Não foi possível carregar seus quadros.");
    } finally {
      setCarregando(false);
    }
  }, [organizationId, aoOrganizacaoInvalida]);

  const selecionarProjeto = useCallback(
    (id) => {
      setProjectId(id);
      if (organizationId) {
        localStorage.setItem(`projetoAtivo:${organizationId}`, id);
      }
    },
    [organizationId]
  );

  // Propositalmente NÃO trata ERRO aqui (ex.: limite do plano gratuito,
  // HTTP 403) — quem chama (o formulário no ProjectSwitcher) precisa do erro
  // para mostrar a mensagem certa ao usuário. Tratar como "organização
  // inválida" aqui, igual ao catch de `carregar`, seria errado: um 403 de
  // limite de plano não significa organização inválida. O toast de SUCESSO,
  // por outro lado, já pode disparar aqui — alinha com o mesmo feedback que
  // useColunas.js já dá ao criar uma coluna.
  const criarProjeto = useCallback(
    async (name, type = "saas") => {
      const resposta = await api.post(`/organizations/${organizationId}/projects`, {
        name,
        type,
      });
      setProjetos((prev) => [...prev, resposta.data]);
      selecionarProjeto(resposta.data.id);
      showToast("Quadro criado com sucesso.", "sucesso");
      return resposta.data;
    },
    [organizationId, selecionarProjeto, showToast]
  );

  // Segue o mesmo padrão de excluirColuna (useColunas.js): otimista na tela,
  // com rollback + resync via carregar() se a API falhar.
  const excluirProjeto = useCallback(
    async (id) => {
      const anterior = projetos;
      const anteriorProjectId = projectId;
      const eraAtivo = projectId === id;
      const restantes = anterior.filter((p) => p.id !== id);

      setProjetos(restantes);
      if (restantes.length === 0) {
        // Não sobra nenhum projeto: limpa o projectId JÁ, e não só depois
        // que o novo padrão terminar de ser provisionado. Sem isso, telas
        // como Dashboard/Tarefas continuam de posse do id do projeto recém
        // excluído (`if (projectId) carregar()`) e tentam buscar cards de
        // um projeto que não existe mais, mostrando "Falha ao carregar
        // dados" até a pessoa dar F5.
        setProjectId(null);
      } else if (eraAtivo) {
        selecionarProjeto(restantes[0].id);
      }

      try {
        await api.delete(`/organizations/${organizationId}/projects/${id}`);
      } catch (err) {
        console.error(err);
        setProjetos(anterior);
        setProjectId(anteriorProjectId);
        showToast(err.response?.data?.erro || "Erro ao excluir quadro.", "erro");
        return false;
      }

      showToast("Quadro excluído com sucesso.", "sucesso");

      if (restantes.length === 0) {
        // A partir daqui a exclusão já está confirmada pelo backend — se a
        // reprovisão do projeto padrão falhar por algum motivo passageiro,
        // não faz sentido desfazer uma exclusão que já aconteceu de verdade.
        // carregar() já trata seus próprios erros internamente (não propaga).
        await carregar();
      }

      return true;
    },
    [organizationId, projetos, projectId, selecionarProjeto, carregar, showToast]
  );

  // Renomear não muda `projectId` — o quadro ativo continua sendo o mesmo
  // id, só com nome diferente, então "manter o quadro atual selecionado"
  // já é garantido automaticamente por não mexer nesse estado.
  const renomearProjeto = useCallback(
    async (id, novoNome) => {
      const anterior = projetos;

      // Otimista: já mostra o nome novo na tela antes da resposta do servidor.
      setProjetos((prev) => prev.map((p) => (p.id === id ? { ...p, name: novoNome } : p)));

      try {
        await api.patch(`/organizations/${organizationId}/projects/${id}`, { name: novoNome });
        showToast("Quadro renomeado com sucesso.", "sucesso");
        return true;
      } catch (err) {
        console.error(err);
        setProjetos(anterior);
        showToast(err.response?.data?.erro || "Erro ao renomear quadro.", "erro");
        return false;
      }
    },
    [organizationId, projetos, showToast]
  );

  return {
    projetos,
    projectId,
    carregando,
    erro,
    carregar,
    selecionarProjeto,
    criarProjeto,
    excluirProjeto,
    renomearProjeto,
  };
}