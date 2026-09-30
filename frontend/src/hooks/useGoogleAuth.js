import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Compartilhado entre Login.jsx e Registro.jsx: os dois botões do Google
// terminam no mesmo endpoint (POST /auth/google) e no mesmo destino — o
// backend já decide sozinho se é uma conta nova, uma vinculação a uma conta
// existente, ou um login de quem já usou o Google antes (Etapa 1). O
// frontend só repassa o credential (ID Token) recebido do Google e trata a
// resposta exatamente como o login tradicional já trata.
export function useGoogleAuth() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function entrarComGoogle(idToken) {
    const resposta = await api.post("/auth/google", { idToken });
    const { token, nome, organizationId, emailVerified } = resposta.data;
    // redirecionar: false — mesmo padrão do login/registro tradicionais
    // (Fase 8.1): quem ainda não tem e-mail verificado vai para a tela de
    // confirmação em vez do dashboard direto. Contas criadas via Google já
    // chegam com emailVerified: true do backend, então na prática isso
    // sempre cai em /dashboard — mas a checagem fica aqui por segurança/
    // consistência, sem assumir esse detalhe do backend.
    login(token, nome, organizationId, { redirecionar: false, emailVerified });
    navigate(emailVerified ? "/dashboard" : "/confirme-seu-email");
  }

  // GoogleLogin (biblioteca) chama onError() sem nenhum argumento quando o
  // próprio Google falha (popup fechado, script bloqueado etc.) — nesses
  // casos não há resposta do nosso backend pra extrair uma mensagem.
  function tratarErroGoogle(err) {
    const mensagem =
      err?.response?.data?.erro || "Não foi possível continuar com o Google. Tente novamente.";
    showToast(mensagem, "erro");
  }

  return { entrarComGoogle, tratarErroGoogle };
}