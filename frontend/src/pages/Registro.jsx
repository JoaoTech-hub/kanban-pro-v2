import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
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

export default function Registro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function registrar(e) {
    e.preventDefault();
    setErro("");

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

  const MENSAGEM_ERRO_SENHA =
  "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número.";

    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
      setErro(MENSAGEM_ERRO_SENHA);
      return;
    }

    setCarregando(true);
    try {
      const resposta = await api.post("/registro", { nome, email, senha });
      login(resposta.data.token, resposta.data.nome, resposta.data.organizationId);
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao criar conta. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <PageWrapper>
      <Card>
        <div>
          <Title><Brandmark /> Kanban Pro</Title>
          <Subtitle>Crie sua conta para começar a organizar suas tarefas</Subtitle>
        </div>

        <form onSubmit={registrar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            required
          />
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
          {erro && <ErrorMsg role="alert">{erro}</ErrorMsg>}
          <SubmitButton type="submit" disabled={carregando}>
            {carregando ? "Criando conta..." : "Criar conta"}
          </SubmitButton>
        </form>

        <FooterLink>
          Já tem conta?{" "}
          <button type="button" onClick={() => navigate("/")}>
            Entrar
          </button>
        </FooterLink>
      </Card>
    </PageWrapper>
  );
}