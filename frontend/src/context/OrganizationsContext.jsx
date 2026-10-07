/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import api from "../services/api";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";

const OrganizationsContext = createContext(null);

// Estado único e compartilhado da lista de organizações do usuário — antes,
// cada componente que chamava useOrganizacoes() tinha sua própria cópia
// isolada (useState local), então renomear a organização em Equipe.jsx não
// atualizava o OrganizationSwitcher na Sidebar sem um refresh manual. Este
// Provider guarda o estado uma única vez; o hook useOrganizacoes() (inalterado
// na assinatura) agora só lê/escreve nesse estado compartilhado.
export function OrganizationsProvider({ children }) {
  const { token } = useAuth();
  const [organizacoes, setOrganizacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const { showToast } = useToast();
  const geracaoRequisicao = useRef(0);

  const carregar = useCallback(async () => {
    const geracaoAtual = ++geracaoRequisicao.current;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get("/organizations");
      if (geracaoAtual !== geracaoRequisicao.current) return;
      setOrganizacoes(resposta.data || []);
    } catch (e) {
      if (geracaoAtual !== geracaoRequisicao.current) return;
      console.error(e);
      setErro("Não foi possível carregar suas organizações.");
    } finally {
      if (geracaoAtual === geracaoRequisicao.current) {
        setCarregando(false);
      }
    }
  }, []);

  // Dispara de novo sempre que o TOKEN mudar (login, logout, login como
  // outra conta na mesma aba) — não a cada navegação de página, já que
  // trocar de rota não muda o token. Isso é a correção da regressão: a
  // versão anterior disparava só uma vez na vida do Provider (deps vazias,
  // Provider nunca remonta), então um login comum (sem passar por aceite
  // de convite) nunca via a lista atualizada — ficava com o que quer que
  // tivesse sido buscado da primeira vez que o Provider montou nesta aba,
  // às vezes antes mesmo do usuário estar autenticado.
  useEffect(() => {
    if (token) {
      // "Buscar quando o token muda" é o mesmo padrão de "buscar ao montar"
      // já usado em ProjectContext/Dashboard; a regra só acusa aqui porque
      // consegue enxergar o setState dentro de `carregar` (mesmo arquivo).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      carregar();
    } else {
      // Logout (ou ainda não autenticado): limpa o estado — evita vazar a
      // lista de organizações da conta anterior pra uma nova sessão na
      // mesma aba.
      // Invalida qualquer busca pendente da sessão anterior.
      geracaoRequisicao.current += 1;
      setOrganizacoes([]);
      setCarregando(false);
    }
  }, [token, carregar]);

  async function sair(organizationId) {
    try {
      const resposta = await api.delete(`/organizations/${organizationId}/members/me`);
      setOrganizacoes(resposta.data.organizacoes || []);
      return { ok: true, organizacoes: resposta.data.organizacoes || [] };
    } catch (e) {
      const mensagem = e.response?.data?.erro || "Não foi possível sair da organização.";
      showToast(mensagem, "erro");
      return { ok: false };
    }
  }

  // Renomear (Feature 6.9 — melhoria 2). Atualiza o estado compartilhado
  // direto com a resposta do servidor — todo consumidor (Sidebar, Equipe)
  // re-renderiza automaticamente, sem refresh e sem novo fetch.
  async function atualizarNome(organizationId, novoNome) {
    try {
      const resposta = await api.patch(`/organizations/${organizationId}`, { name: novoNome });
      setOrganizacoes((atual) =>
        atual.map((org) => (org.id === organizationId ? { ...org, name: resposta.data.name } : org))
      );
      showToast("Nome da organização atualizado.", "sucesso");
      return true;
    } catch (e) {
      const mensagem = e.response?.data?.erro || "Não foi possível atualizar o nome da organização.";
      showToast(mensagem, "erro");
      return false;
    }
  }

  return (
    <OrganizationsContext.Provider
      value={{ organizacoes, carregando, erro, carregar, sair, atualizarNome }}
    >
      {children}
    </OrganizationsContext.Provider>
  );
}

export function useOrganizationsContext() {
  const ctx = useContext(OrganizationsContext);
  if (!ctx) {
    throw new Error("useOrganizationsContext deve ser usado dentro de OrganizationsProvider");
  }
  return ctx;
}
