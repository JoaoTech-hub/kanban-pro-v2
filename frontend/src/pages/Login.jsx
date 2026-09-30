import { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";
import Brandmark from "../components/UI/Brandmark";
import GoogleAuthButton from "../components/GoogleAuthButton";
import {
  PageWrapper,
  Card,
  Title,
  Subtitle,
  Input,
  SubmitButton,
  ErrorMsg,
  FooterLink,
  Divider,
} from "../styles/AuthStyles";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const { login, trocarOrganizacao, autenticado } = useAuth();
  const { carregar: carregarOrganizacoes } = useOrganizacoes();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const conviteToken = location.state?.conviteToken;

  // Se já existe uma sessão válida (token sobrevivendo no localStorage de
  // uma aba fechada sem "Sair", por exemplo), não faz sentido mostrar o
  // formulário de login — e mais importante, evita que os Providers globais
  // (Organizations/Project/Team/Kanban) fiquem buscando dados da conta
  // antiga em segundo plano enquanto essa tela está visível, o que causava
  // um "flash" dos dados da conta anterior ao logar com uma conta diferente
  // logo em seguida. Exceção: o fluxo de aceite de convite explicitamente
  // permite logar como uma conta diferente da que já está autenticada,
  // então esse caso não é redirecionado.
  if (autenticado && !conviteToken) {
    return <Navigate to="/dashboard" replace />;
  }

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const resposta = await api.post("/login", { email, senha });

      if (conviteToken) {
        // Fluxo de convite preservado como estava: sempre segue para o
        // dashboard após aceitar (comportamento fora do escopo desta
        // etapa). Só passamos emailVerified para o AuthContext manter o
        // estado coerente com o que o backend retornou.
        login(resposta.data.token, resposta.data.nome, resposta.data.organizationId, {
          redirecionar: false,
          emailVerified: resposta.data.emailVerified,
        });

        try {
          const aceite = await api.post(`/convites/${conviteToken}/aceitar-existente`);
          trocarOrganizacao(aceite.data.organizationId);
          await carregarOrganizacoes();
          showToast("Convite aceito com sucesso!", "sucesso");
        } catch (err) {
          showToast(
            err.response?.data?.erro || "Não foi possível aceitar o convite.",
            "erro"
          );
        }

        navigate("/dashboard");
        return;
      }

      const { token, nome, organizationId, emailVerified } = resposta.data;
      // Fase 8.1: controle explícito da navegação (redirecionar: false)
      // para encaminhar quem ainda não confirmou o e-mail para a tela de
      // confirmação, em vez do dashboard direto.
      login(token, nome, organizationId, { redirecionar: false, emailVerified });
      navigate(emailVerified ? "/dashboard" : "/confirme-seu-email");
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
          <Title><Brandmark /> Kanban Pro</Title>
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

        {!conviteToken && (
          <>
            <Divider>ou</Divider>
            <GoogleAuthButton text="signin_with" />
          </>
        )}

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