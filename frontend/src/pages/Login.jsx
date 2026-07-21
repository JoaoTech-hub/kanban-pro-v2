import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
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
  const { login } = useAuth();
  const navigate = useNavigate();

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const resposta = await api.post("/login", { email, senha });
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
          <Subtitle>Entre para gerenciar suas tarefas</Subtitle>
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

        <FooterLink>
          Ainda não tem conta?{" "}
          <button type="button" onClick={() => navigate("/registro")}>
            Criar conta
          </button>
        </FooterLink>
      </Card>
    </PageWrapper>
  );
}