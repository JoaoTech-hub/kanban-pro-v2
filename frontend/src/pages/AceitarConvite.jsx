import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";
import Brandmark from "../components/UI/Brandmark";
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

const MENSAGEM_ERRO_SENHA =
  "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número.";

export default function AceitarConvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { carregar: carregarOrganizacoes } = useOrganizacoes();

  const [convite, setConvite] = useState(null);
  const [carregandoConvite, setCarregandoConvite] = useState(true);
  const [erroConvite, setErroConvite] = useState("");

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erroForm, setErroForm] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get(`/convites/${token}`)
      .then((resposta) => {
        if (ativo) setConvite(resposta.data);
      })
      .catch((err) => {
        if (ativo) {
          setErroConvite(
            err.response?.data?.erro || "Este convite é inválido, expirou ou já foi utilizado."
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregandoConvite(false);
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  function irParaLogin() {
    navigate("/", { state: { conviteToken: token, conviteEmail: convite?.email } });
  }

  async function criarContaEAceitar(e) {
    e.preventDefault();
    setErroForm("");

    if (senha !== confirmarSenha) {
      setErroForm("As senhas não coincidem.");
      return;
    }
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
      setErroForm(MENSAGEM_ERRO_SENHA);
      return;
    }

    setEnviando(true);
    try {
      const resposta = await api.post(`/convites/${token}/aceitar-novo`, { nome, senha });

      login(resposta.data.token, resposta.data.nome, resposta.data.organizationId, {
        redirecionar: false,
      });
      await carregarOrganizacoes();
      navigate("/dashboard");
    } catch (err) {
      setErroForm(
        err.response?.data?.erro || "Não foi possível aceitar o convite. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (carregandoConvite) {
    return (
      <PageWrapper>
        <Card>
          <Title><Brandmark /> Kanban Pro</Title>
          <Subtitle>Carregando convite...</Subtitle>
        </Card>
      </PageWrapper>
    );
  }

  if (erroConvite) {
    return (
      <PageWrapper>
        <Card>
          <div>
            <Title><Brandmark /> Kanban Pro</Title>
            <Subtitle>Convite inválido</Subtitle>
          </div>
          <ErrorMsg role="alert">{erroConvite}</ErrorMsg>
          <FooterLink>
            <button type="button" onClick={() => navigate("/")}>
              Ir para o login
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
          <Title><Brandmark /> Kanban Pro</Title>
          <Subtitle>
            {convite.nomeConvidante} te convidou para {convite.nomeOrganizacao}
          </Subtitle>
        </div>

        {convite.contaExistente ? (
          <>
            <p style={{ fontSize: 14, opacity: 0.75 }}>
              Já existe uma conta com o e-mail <strong>{convite.email}</strong>. Faça login para
              aceitar o convite.
            </p>
            <SubmitButton type="button" onClick={irParaLogin}>
              Fazer login para aceitar
            </SubmitButton>
          </>
        ) : (
          <form
            onSubmit={criarContaEAceitar}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Input value={convite.email} disabled readOnly />
            <Input
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              required
            />
            <Input
              type="password"
              placeholder="Crie uma senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              type="password"
              placeholder="Confirmar senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              autoComplete="new-password"
              required
            />
            {erroForm && <ErrorMsg role="alert">{erroForm}</ErrorMsg>}
            <SubmitButton type="submit" disabled={enviando}>
              {enviando ? "Aceitando..." : "Criar conta e aceitar convite"}
            </SubmitButton>
          </form>
        )}
      </Card>
    </PageWrapper>
  );
}