/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useProjetos } from "../hooks/useProjetos";
import api from "../services/api";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { organizationId, emailVerified, trocarOrganizacao, logout } = useAuth();

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

  const { carregar, ...resto } = useProjetos(
    organizationId,
    handleOrganizacaoInvalida,
    Boolean(organizationId && emailVerified)
  );

  useEffect(() => {
    // Fase 8.1 (correção de auditoria): enquanto o e-mail não estiver
    // verificado, o backend responde 403 EMAIL_NAO_VERIFICADO para
    // qualquer rota organization-scoped (ver requireOrganization no
    // backend) — carregar aqui só serviria para acionar
    // handleOrganizacaoInvalida indevidamente (ela foi desenhada para
    // token adulterado/organização removida, não para e-mail pendente).
    // A forma correta é simplesmente não disparar o carregamento
    // automático enquanto isso, e deixar carregar() disponível para
    // quando organizationId && emailVerified voltarem a ser verdadeiros.
    if (organizationId && emailVerified) carregar();
  }, [organizationId, emailVerified, carregar]);

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
