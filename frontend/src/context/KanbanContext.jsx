/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useProject } from "./ProjectContext";
import { useKanban as useKanbanEngine, normalizarCard, normalizarColuna } from "../hooks/useKanban";
import { useColunas } from "../hooks/useColunas";

const KanbanContext = createContext(null);

// Mesmo padrão de ProjectContext: um Provider fino que chama o hook de
// estado já existente (useKanban + useColunas, ambos inalterados) uma
// única vez, montado acima do <Routes> — não a cada visita a
// Dashboard/Projetos/Tarefas. O refetch só acontece quando organizationId
// ou projectId mudam de verdade (não a cada navegação de página).
export function KanbanProvider({ children }) {
  const { organizationId } = useAuth();
  const { projectId } = useProject();

  const kanban = useKanbanEngine(organizationId, projectId);
  const { carregar } = kanban;

  const colunasHook = useColunas(organizationId, projectId, {
    colunas: kanban.colunas,
    setColunas: kanban.setColunas,
    setCards: kanban.setCards,
    carregar,
  });

  // Distingue "nunca carreguei" (mostra loading) de "já tenho dado, só
  // sincronizando" (mantém o conteúdo na tela) — ver requisito 9. Reseta
  // quando o projeto muda, porque aí sim é uma primeira carga de verdade
  // pra esse projeto específico.
  const [carregouAoMenosUmaVez, setCarregouAoMenosUmaVez] = useState(false);
  const projectIdAnterior = useRef(projectId);

  useEffect(() => {
    if (projectId !== projectIdAnterior.current) {
      projectIdAnterior.current = projectId;
      setCarregouAoMenosUmaVez(false);
    }
    if (projectId) {
      carregar().then(() => setCarregouAoMenosUmaVez(true));
    }
  }, [projectId, carregar]);

  const valor = { ...kanban, ...colunasHook, carregouAoMenosUmaVez };

  return <KanbanContext.Provider value={valor}>{children}</KanbanContext.Provider>;
}

export function useKanban() {
  const ctx = useContext(KanbanContext);
  if (!ctx) {
    throw new Error("useKanban (context) deve ser usado dentro de KanbanProvider");
  }
  return ctx;
}

export { normalizarCard, normalizarColuna };