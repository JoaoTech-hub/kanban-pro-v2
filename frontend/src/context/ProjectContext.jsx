/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useProjetos } from "../hooks/useProjetos";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { organizationId, logout } = useAuth();

  const { carregar, ...resto } = useProjetos(
    organizationId,
    logout // organização inválida → desloga e manda pro login, que resolve a organização certa
  );

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