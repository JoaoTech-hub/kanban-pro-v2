import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";
import {
  PageWrapper,
  Card,
  Title,
  Subtitle,
  Input,
  SubmitButton,
  ErrorMsg,
  FooterLink,
} from "../styles/AuthStyles";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const { login, trocarOrganizacao } = useAuth();
  const { carregar: carregarOrganizacoes } = useOrganizacoes();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Presente quando o usuário chegou aqui a partir de /convites/:token
  // (Feature 6.8, fluxo "conta já existente" — ver AceitarConvite.jsx).
  const conviteToken = location.state?.conviteToken;

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const resposta = await api.post("/login", { email, senha });

      if (conviteToken) {
        // Loga sem redirecionar ainda: primeiro precisa aceitar o convite
        // e trocar para a organização recém-aceita, senão o usuário cairia
        // no dashboard da organização antiga.
        login(resposta.data.token, resposta.data.nome, resposta.data.organizationId, {
          redirecionar: false,
        });

        try {
          const aceite = await api.post(`/convites/${conviteToken}/aceitar-existente`);
          trocarOrganizacao(aceite.data.organizationId);
          // Mesma razão do fluxo de conta nova: a organização recém-aceita
          // não existe na lista em memória do OrganizationsContext até
          // recarregar — sem isso, o seletor/Equipe não a veriam sem F5.
          await carregarOrganizacoes();
          showToast("Convite aceito com sucesso!", "sucesso");
        } catch (err) {
          // O login em si já deu certo — só o aceite do convite falhou
          // (ex.: token expirou entre a tela de convite e o login). O
          // usuário ainda consegue acessar a conta normalmente.
          showToast(
            err.response?.data?.erro || "Não foi possível aceitar o convite.",
            "erro"
          );
        }

        navigate("/dashboard");
        return;
      }

      login(resposta.data.token, resposta.data.nome, resposta.data.organizationId);
    } catch {
      setErro("E-mail ou senha inválidos.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <PageWrapper>
      <Card>
        <div>
          <Title>🚀 Kanban Pro</Title>
          <Subtitle>
            {conviteToken ? "Entre para aceitar o convite" : "Entre para gerenciar suas tarefas"}
          </Subtitle>
        </div>

        <form onSubmit={entrar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
          {erro && <ErrorMsg role="alert">{erro}</ErrorMsg>}
          <SubmitButton type="submit" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </SubmitButton>
        </form>

        <FooterLink>
          <button type="button" onClick={() => navigate("/esqueci-senha")}>
            Esqueci minha senha
          </button>
        </FooterLink>

        {!conviteToken && (
          <FooterLink>
            Ainda não tem conta?{" "}
            <button type="button" onClick={() => navigate("/registro")}>
              Criar conta
            </button>
          </FooterLink>
        )}
      </Card>
    </PageWrapper>
  );
}