import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import {
  PageWrapper,
  Card,
  Title,
  Subtitle,
  Input,
  SubmitButton,
  ErrorMsg,
  SuccessMsg,
  FooterLink,
} from "../styles/AuthStyles";

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function redefinir(e) {
    e.preventDefault();
    setErro("");

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (novaSenha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      await api.post("/redefinir-senha", { token, novaSenha });
      setConcluido(true);
    } catch (err) {
      // O backend retorna 401 com "Token inválido ou expirado" quando o token
      // já foi usado, expirou (1h) ou nunca existiu — a mensagem já é
      // amigável o suficiente para ser exibida diretamente.
      setErro(err.response?.data?.erro || "Não foi possível redefinir sua senha. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  // Sem token na URL: o usuário chegou aqui sem passar pelo link do e-mail
  // (ex.: acesso direto a /redefinir-senha). Não faz sentido mostrar o formulário.
  if (!token) {
    return (
      <PageWrapper>
        <Card>
          <div>
            <Title>🚀 Kanban Pro</Title>
            <Subtitle>Link inválido</Subtitle>
          </div>
          <ErrorMsg role="alert">
            Este link de redefinição de senha é inválido ou está incompleto.
          </ErrorMsg>
          <FooterLink>
            <button type="button" onClick={() => navigate("/esqueci-senha")}>
              Solicitar um novo link
            </button>
          </FooterLink>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Card>
        <div>
          <Title>🚀 Kanban Pro</Title>
          <Subtitle>
            {concluido ? "Senha redefinida" : "Escolha sua nova senha"}
          </Subtitle>
        </div>

        {concluido ? (
          <>
            <SuccessMsg role="status">
              Sua senha foi redefinida com sucesso. Todas as sessões anteriores foram
              encerradas por segurança.
            </SuccessMsg>
            <SubmitButton type="button" onClick={() => navigate("/")}>
              Ir para o login
            </SubmitButton>
          </>
        ) : (
          <form onSubmit={redefinir} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              type="password"
              placeholder="Nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              autoComplete="new-password"
              required
            />
            {erro && <ErrorMsg role="alert">{erro}</ErrorMsg>}
            <SubmitButton type="submit" disabled={carregando}>
              {carregando ? "Redefinindo..." : "Redefinir senha"}
            </SubmitButton>
          </form>
        )}

        {!concluido && (
          <FooterLink>
            <button type="button" onClick={() => navigate("/")}>
              Voltar para o login
            </button>
          </FooterLink>
        )}
      </Card>
    </PageWrapper>
  );
}