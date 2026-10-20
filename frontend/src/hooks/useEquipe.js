import { useState, useCallback, useRef } from "react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useOrganizacoes } from "./useOrganizacoes";

export function useEquipe(organizationId) {
  const [membros, setMembros] = useState([]);
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const organizationIdAtual = useRef(organizationId);
  const geracaoRequisicao = useRef(0);
  organizationIdAtual.current = organizationId;
  const { showToast } = useToast();
  // Precisamos disso só pra atualizar o role do usuário atual (souOwner etc.)
  // depois de transferir ownership — carregar()/removerMembro/alterarRole
  // de membros de EQUIPE continuam só no estado local deste hook.
  const { carregar: recarregarOrganizacoes } = useOrganizacoes();

  const carregar = useCallback(async () => {
    if (!organizationId) return;
    const geracaoAtual = ++geracaoRequisicao.current;
    setCarregando(true);
    try {
      const [membrosResp, convitesResp] = await Promise.all([
        api.get(`/organizations/${organizationId}/members`),
        api.get(`/organizations/${organizationId}/invites`),
      ]);
      if (geracaoAtual !== geracaoRequisicao.current || organizationIdAtual.current !== organizationId) return;
      setMembros(membrosResp.data || []);
      setConvites(convitesResp.data || []);
    } catch (e) {
      if (geracaoAtual !== geracaoRequisicao.current || organizationIdAtual.current !== organizationId) return;
      console.error(e);
      showToast("Não foi possível carregar a equipe.", "erro");
    } finally {
      if (geracaoAtual === geracaoRequisicao.current && organizationIdAtual.current === organizationId) {
        setCarregando(false);
      }
    }
  }, [organizationId, showToast]);

  async function convidar(email, role) {
    try {
      await api.post(`/organizations/${organizationId}/invites`, { email, role });
      showToast(`Convite enviado para ${email}.`, "sucesso");
      await carregar();
      return true;
    } catch (e) {
      const mensagem = e.response?.data?.erro || "Não foi possível enviar o convite.";
      showToast(mensagem, "erro");
      return false;
    }
  }

  async function revogarConvite(inviteId) {
    try {
      await api.delete(`/organizations/${organizationId}/invites/${inviteId}`);
      showToast("Convite revogado.", "sucesso");
      await carregar();
    } catch {
      showToast("Não foi possível revogar o convite.", "erro");
    }
  }

  async function alterarRole(userId, role) {
    try {
      await api.patch(`/organizations/${organizationId}/members/${userId}`, { role });
      showToast("Papel do membro atualizado.", "sucesso");
      await carregar();
    } catch (e) {
      const mensagem = e.response?.data?.erro || "Não foi possível alterar o papel do membro.";
      showToast(mensagem, "erro");
    }
  }

  async function removerMembro(userId) {
    try {
      await api.delete(`/organizations/${organizationId}/members/${userId}`);
      showToast("Membro removido da organização.", "sucesso");
      await carregar();
    } catch (e) {
      const mensagem = e.response?.data?.erro || "Não foi possível remover o membro.";
      showToast(mensagem, "erro");
    }
  }

  // Transferência de ownership (Feature 6.9) — só o owner chama isso (a UI
  // já esconde a ação de quem não é owner; o backend também garante isso
  // via garantirPodeTransferirOwnership). O owner atual vira admin, o alvo
  // vira owner — troca 1:1, nunca dois owners ao mesmo tempo.
  async function transferirOwnership(novoOwnerUserId) {
    try {
      await api.post(`/organizations/${organizationId}/members/transfer-ownership`, {
        novoOwnerUserId,
      });
      showToast("Propriedade da organização transferida.", "sucesso");
      await Promise.all([carregar(), recarregarOrganizacoes()]);
      return true;
    } catch (e) {
      const mensagem = e.response?.data?.erro || "Não foi possível transferir a propriedade.";
      showToast(mensagem, "erro");
      return false;
    }
  }

  return {
    membros,
    convites,
    carregando,
    carregar,
    convidar,
    revogarConvite,
    alterarRole,
    removerMembro,
    transferirOwnership,
  };
}
