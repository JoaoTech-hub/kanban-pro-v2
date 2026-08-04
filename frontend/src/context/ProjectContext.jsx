/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useProjetos } from "../hooks/useProjetos";
import api from "../services/api";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { organizationId, trocarOrganizacao, logout } = useAuth();

  // Disparado por useProjetos.js só quando a checagem de vínculo com a
  // organização ativa falha (403/404 na listagem de projetos da própria
  // organização — nunca em erros de um projeto/card/coluna específico,
  // ver comentário em useProjetos.js#carregar). Antes da Feature 6.9, a
  // única saída possível era deslogar; agora, com suporte a multi-org, o
  // certo é tentar trocar para outra organização válida do usuário antes
  // de recorrer ao logout.
  const handleOrganizacaoInvalida = useCallback(async () => {
    try {
      const resposta = await api.get("/organizations");
      const organizacoes = resposta.data || [];
      const proxima = organizacoes.find((o) => o.id !== organizationId) || organizacoes[0];

      if (proxima) {
        trocarOrganizacao(proxima.id);
        return;
      }
    } catch (e) {
      console.error("Falha ao buscar organizações após perda de vínculo:", e);
    }

    // Sem nenhuma organização restante (ou a própria checagem falhou) —
    // não há pra onde trocar, o logout continua sendo o fallback seguro.
    logout();
  }, [organizationId, trocarOrganizacao, logout]);

  const { carregar, ...resto } = useProjetos(organizationId, handleOrganizacaoInvalida);

  useEffect(() => {
    if (organizationId) carregar();
  }, [organizationId, carregar]);

  const valor = { ...resto, carregar };

  return <ProjectContext.Provider value={valor}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const contexto = useContext(ProjectContext);
  if (!contexto) {
    throw new Error("useProject precisa ser usado dentro de um ProjectProvider");
  }
  return contexto;
}