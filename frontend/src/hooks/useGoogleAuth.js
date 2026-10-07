import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Compartilhado entre Login.jsx e Registro.jsx: ambos usam POST /auth/google.
// O Login pode fornecer um callback para concluir um fluxo iniciado por
// convite; sem callback, o destino padrão continua sendo o dashboard/email.
export function useGoogleAuth() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function entrarComGoogle(idToken, aoAutenticar) {
    const resposta = await api.post("/auth/google", { idToken });
    const { token, nome, organizationId, emailVerified } = resposta.data;
    // redirecionar: false — mesmo padrão do login/registro tradicionais
    // (Fase 8.1): quem ainda não tem e-mail verificado vai para a tela de
    // confirmação em vez do dashboard direto. Contas criadas via Google já
    // chegam com emailVerified: true do backend, então na prática isso
    // sempre cai em /dashboard — mas a checagem fica aqui por segurança/
    // consistência, sem assumir esse detalhe do backend.
    login(token, nome, organizationId, { redirecionar: false, emailVerified });

    if (aoAutenticar) {
      await aoAutenticar(resposta.data);
      return;
    }

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
