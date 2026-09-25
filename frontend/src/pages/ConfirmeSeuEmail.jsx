import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import Brandmark from "../components/UI/Brandmark";
import { PageWrapper, Card, Title, Subtitle, SubmitButton, FooterLink } from "../styles/AuthStyles";

export default function ConfirmeSeuEmail() {
  const { logout, emailVerified } = useAuth();
  const { showToast } = useToast();
  const [enviando, setEnviando] = useState(false);

  // Fase 8.1 (Bloco 2): se o e-mail já está verificado (ex.: confirmado em
  // outra aba, ou AuthContext já sincronizado pelo Bloco 1), esta tela não
  // faz mais sentido — manda direto pro dashboard. Usa <Navigate> (em vez de
  // navigate() num useEffect) para não haver um frame renderizando o corpo
  // da tela antes do redirecionamento, e porque é puramente declarativo: não
  // dispara reenvio nem mostra nenhuma mensagem, então não há risco de loop.
  if (emailVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  async function reenviar() {
    // Impede múltiplos cliques simultâneos enquanto a requisição está em voo.
    if (enviando) return;

    setEnviando(true);
    try {
      await api.post("/reenviar-verificacao");
      showToast("E-mail de confirmação reenviado. Confira sua caixa de entrada.", "sucesso");
    } catch (err) {
      if (err.response?.status === 409) {
        showToast(
          err.response?.data?.erro ||
            "Aguarde um pouco antes de solicitar um novo e-mail de confirmação.",
          "erro"
        );
      } else if (err.response?.status === 401) {
        // Sessão/token inválido: o interceptor global de api.js já cuida do
        // logout automático e do redirecionamento para o login nesse caso.
        showToast("Sua sessão expirou. Faça login novamente.", "erro");
      } else {
        showToast("Não foi possível reenviar o e-mail. Tente novamente.", "erro");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PageWrapper>
      <Card>
        <div>
          <Title><Brandmark /> Kanban Pro</Title>
          <Subtitle>Verifique seu e-mail</Subtitle>
        </div>

        <p style={{ fontSize: 14, opacity: 0.75, margin: 0 }}>
          Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar
          sua conta e liberar o acesso completo.
        </p>

        <SubmitButton type="button" onClick={reenviar} disabled={enviando}>
          {enviando ? "Reenviando..." : "Reenviar e-mail de confirmação"}
        </SubmitButton>

        <FooterLink>
          <button type="button" onClick={logout}>
            Voltar para o login
          </button>
        </FooterLink>
      </Card>
    </PageWrapper>
  );
}