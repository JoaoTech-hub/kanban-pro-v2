/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useEquipe as useEquipeEngine } from "../hooks/useEquipe";

const TeamContext = createContext(null);

// Mesmo padrão de ProjectContext/KanbanContext: Provider fino em cima do
// hook de estado já existente (useEquipe, inalterado), montado uma única
// vez acima do <Routes> — não a cada visita à página Equipe. Refetch só
// quando organizationId muda (troca de organização), não a cada navegação.
export function TeamProvider({ children }) {
  const { organizationId, emailVerified } = useAuth();
  const equipe = useEquipeEngine(organizationId);
  const { carregar } = equipe;

  const [carregouAoMenosUmaVez, setCarregouAoMenosUmaVez] = useState(false);
  const organizationIdAnterior = useRef(organizationId);

  useEffect(() => {
    if (organizationId !== organizationIdAnterior.current) {
      organizationIdAnterior.current = organizationId;
      setCarregouAoMenosUmaVez(false);
    }
    // Fase 8.1 (correção de auditoria): mesma razão do ProjectContext — só
    // dispara o carregamento automático quando o e-mail já está
    // verificado, para não bater em GET /organizations/:id/members e
    // .../invites (bloqueados por requireOrganization) e disparar o toast
    // de erro genérico de useEquipe.js indevidamente.
    if (organizationId && emailVerified) {
      carregar().then(() => setCarregouAoMenosUmaVez(true));
    }
  }, [organizationId, emailVerified, carregar]);

  const valor = { ...equipe, carregouAoMenosUmaVez };

  return <TeamContext.Provider value={valor}>{children}</TeamContext.Provider>;
}

export function useEquipe() {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error("useEquipe (context) deve ser usado dentro de TeamProvider");
  }
  return ctx;
}