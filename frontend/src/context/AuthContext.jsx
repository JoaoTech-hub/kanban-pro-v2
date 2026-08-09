/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [nome, setNome] = useState(() => localStorage.getItem("nome") || "");
  const [organizationId, setOrganizationId] = useState(
    () => localStorage.getItem("organizationId") || ""
  );
  const navigate = useNavigate();

  // Estabiliza o acesso a `navigate` contra a instabilidade de referência
  // observada entre navegações de rota — sem isso, `login`/`logout`
  // (que precisavam de `navigate` como dependência) ganhavam uma nova
  // identidade a cada troca de página, o que cascateava até o
  // ProjectContext refazer o fetch de projetos desnecessariamente (causa
  // raiz do flash de "Carregando..." investigado). A ref é atualizada a
  // cada render (síncrono, antes de qualquer efeito), então sempre aponta
  // pra função de navegação mais atual — só que, ao contrário de `navigate`
  // em si, `navigateRef` nunca muda de identidade, então `login`/`logout`
  // podem depender dela sem nunca precisar ser recriados.
  const navigateRef = useRef(navigate);
  useLayoutEffect(() => {
    navigateRef.current = navigate;
  });

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
      if (redirecionar) navigateRef.current("/dashboard");
    },
    []
  );

  // Troca a organização ativa sem mexer no token/sessão — usado pelo
  // seletor de organização (suporte a multi-org) e ao aceitar um convite
  // enquanto já logado em outra organização.
  const trocarOrganizacao = useCallback((novaOrganizationId) => {
    localStorage.setItem("organizationId", novaOrganizationId || "");
    setOrganizationId(novaOrganizationId || "");
  }, []);

  // Atualiza o nome sem mexer em token/organização — usado por Perfil.jsx
  // depois de salvar um novo nome, pra manter o AuthContext como fonte
  // confiável (hoje nada mais exibe esse nome, mas deixá-lo desatualizado
  // depois de uma alteração bem-sucedida seria inconsistente).
  const atualizarNome = useCallback((novoNome) => {
    localStorage.setItem("nome", novoNome);
    setNome(novoNome);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("nome");
    localStorage.removeItem("organizationId");
    setToken(null);
    setNome("");
    setOrganizationId("");
    navigateRef.current("/");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        nome,
        organizationId,
        login,
        logout,
        trocarOrganizacao,
        atualizarNome,
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