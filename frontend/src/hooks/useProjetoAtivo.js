import { useState, useCallback, useEffect } from "react";
import api from "../services/api";

const NOME_PROJETO_PADRAO = "Meu Quadro";

export function useProjetoAtivo(organizationId, aoOrganizacaoInvalida) {
  const [projectId, setProjectId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const resolverProjeto = useCallback(async () => {
    if (!organizationId) return;

    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/organizations/${organizationId}/projects`);
      const projetos = resposta.data;

      if (projetos.length > 0) {
        setProjectId(projetos[0].id);
      } else {
        const criado = await api.post(`/organizations/${organizationId}/projects`, {
          name: NOME_PROJETO_PADRAO,
        });
        setProjectId(criado.data.id);
      }
    } catch (e) {
      const status = e.response?.status;

      // organizationId salvo localmente não é mais válido (adulterado manualmente,
      // organização removida, etc). Como ainda não existe seletor de organizações,
      // a única recuperação segura é forçar um novo login — ele busca a
      // organização correta do zero, sem deixar o usuário preso numa tela de erro.
      if ((status === 403 || status === 404) && aoOrganizacaoInvalida) {
        aoOrganizacaoInvalida();
        return;
      }

      console.error(e);
      setErro("Não foi possível carregar o projeto.");
    } finally {
      setCarregando(false);
    }
  }, [organizationId, aoOrganizacaoInvalida]);

  useEffect(() => {
    resolverProjeto();
  }, [resolverProjeto]);

  return { projectId, carregando, erro };
}