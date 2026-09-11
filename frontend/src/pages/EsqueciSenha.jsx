import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Brandmark from "../components/UI/Brandmark";
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

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function solicitar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      await api.post("/esqueci-senha", { email });
      setEnviado(true);
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível enviar o e-mail. Tente novamente.");
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
            {enviado
              ? "Verifique sua caixa de entrada"
              : "Informe seu e-mail para receber o link de recuperação"}
          </Subtitle>
        </div>

        {enviado ? (
          <SuccessMsg role="status">
            Se o e-mail informado existir em nossa base, você receberá um link para
            redefinir sua senha em instantes. O link expira em 1 hora.
          </SuccessMsg>
        ) : (
          <form onSubmit={solicitar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {erro && <ErrorMsg role="alert">{erro}</ErrorMsg>}
            <SubmitButton type="submit" disabled={carregando}>
              {carregando ? "Enviando..." : "Enviar link de recuperação"}
            </SubmitButton>
          </form>
        )}

        <FooterLink>
          Lembrou sua senha?{" "}
          <button type="button" onClick={() => navigate("/")}>
            Voltar para o login
          </button>
        </FooterLink>
      </Card>
    </PageWrapper>
  );
}