/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [nome, setNome] = useState(() => localStorage.getItem("nome") || "");
  const [organizationId, setOrganizationId] = useState(
    () => localStorage.getItem("organizationId") || ""
  );
  const navigate = useNavigate();

  // `redirecionar: false` é usado pelo fluxo de aceite de convite (Feature
  // 6.8): a pessoa já tem conta e está fazendo login só pra aceitar um
  // convite — nesse caso, quem chamou o login precisa controlar o destino
  // (trocar a organização ativa pra recém-aceita antes de ir pro dashboard),
  // em vez de já cair direto em /dashboard com a organização antiga.
  const login = useCallback(
    (novoToken, nomeUsuario, novaOrganizationId, { redirecionar = true } = {}) => {
      localStorage.setItem("token", novoToken);
      localStorage.setItem("nome", nomeUsuario);
      localStorage.setItem("organizationId", novaOrganizationId || "");
      setToken(novoToken);
      setNome(nomeUsuario);
      setOrganizationId(novaOrganizationId || "");
      if (redirecionar) navigate("/dashboard");
    },
    [navigate]
  );

  // Troca a organização ativa sem mexer no token/sessão — usado pelo
  // seletor de organização (suporte a multi-org) e ao aceitar um convite
  // enquanto já logado em outra organização.
  const trocarOrganizacao = useCallback((novaOrganizationId) => {
    localStorage.setItem("organizationId", novaOrganizationId || "");
    setOrganizationId(novaOrganizationId || "");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("nome");
    localStorage.removeItem("organizationId");
    setToken(null);
    setNome("");
    setOrganizationId("");
    navigate("/");
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        token,
        nome,
        organizationId,
        login,
        logout,
        trocarOrganizacao,
        autenticado: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}