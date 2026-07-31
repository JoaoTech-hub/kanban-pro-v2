import { useState, useCallback } from "react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";

export function useEquipe(organizationId) {
  const [membros, setMembros] = useState([]);
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const { showToast } = useToast();

  const carregar = useCallback(async () => {
    if (!organizationId) return;
    setCarregando(true);
    try {
      const [membrosResp, convitesResp] = await Promise.all([
        api.get(`/organizations/${organizationId}/members`),
        api.get(`/organizations/${organizationId}/invites`),
      ]);
      setMembros(membrosResp.data || []);
      setConvites(convitesResp.data || []);
    } catch (e) {
      console.error(e);
      showToast("Não foi possível carregar a equipe.", "erro");
    } finally {
      setCarregando(false);
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

  return {
    membros,
    convites,
    carregando,
    carregar,
    convidar,
    revogarConvite,
    alterarRole,
    removerMembro,
  };
}