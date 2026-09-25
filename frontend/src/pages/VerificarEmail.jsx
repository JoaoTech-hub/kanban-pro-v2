import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Brandmark from "../components/UI/Brandmark";
import { PageWrapper, Card, Title, Subtitle, SubmitButton, ErrorMsg, SuccessMsg } from "../styles/AuthStyles";

export default function VerificarEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { autenticado, marcarEmailVerificado } = useAuth();

  const [estado, setEstado] = useState(token ? "carregando" : "semToken");
  const [erro, setErro] = useState("");
  const jaEnviado = useRef(false);

  useEffect(() => {
    if (!token || jaEnviado.current) return;
    jaEnviado.current = true;

    api
      .post("/verificar-email", { token })
      .then(() => {
        // Fase 8.1 (Bloco 1): o backend já marcou o usuário como verificado.
        // Se houver uma sessão autenticada neste navegador, sincroniza o
        // AuthContext/localStorage imediatamente — sem novo login, sem
        // mexer em token/nome/organizationId. Se estiver deslogado, não há
        // sessão local para sincronizar; comportamento atual é preservado.
        if (autenticado) marcarEmailVerificado();
        setEstado("sucesso");
      })
      .catch((err) => {
        // Não expomos detalhes internos do backend — só a mensagem de
        // domínio (ex.: "Token inválido ou expirado") já pensada para o
        // usuário final, com uma mensagem genérica de fallback.
        setErro(err.response?.data?.erro || "Não foi possível confirmar seu e-mail.");
        setEstado("erro");
            });
    // autenticado/marcarEmailVerificado propositalmente fora do array: o
    // guard de jaEnviado já garante que este efeito roda no máximo uma vez
    // por token, então não há motivo para reexecutar caso o estado de auth
    // mude entre renders (mesmo padrão usado em Perfil.jsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PageWrapper>
      <Card>
        <div>
          <Title><Brandmark /> Kanban Pro</Title>
          <Subtitle>Confirmação de e-mail</Subtitle>
        </div>

        {estado === "semToken" && (
          <ErrorMsg role="alert">Este link de confirmação é inválido ou está incompleto.</ErrorMsg>
        )}

        {estado === "carregando" && (
          <p role="status" style={{ fontSize: 14, opacity: 0.75, textAlign: "center", margin: 0 }}>
            Confirmando seu e-mail...
          </p>
        )}

        {estado === "sucesso" && (
          <SuccessMsg role="status">
            E-mail confirmado com sucesso. Sua conta já está totalmente liberada.
          </SuccessMsg>
        )}

        {estado === "erro" && <ErrorMsg role="alert">{erro}</ErrorMsg>}

        {estado !== "carregando" && (
          <SubmitButton type="button" onClick={() => navigate("/")}>
            Ir para o login
          </SubmitButton>
        )}
      </Card>
    </PageWrapper>
  );
}