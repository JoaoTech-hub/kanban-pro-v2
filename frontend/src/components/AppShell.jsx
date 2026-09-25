import styled from "styled-components";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";

const Wrapper = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${({ theme }) => theme.background};
`;

const Main = styled.main`
  flex: 1;
  padding: 40px;
  min-width: 0;

  @media (max-width: 768px) {
    padding: 24px 16px;
    padding-top: 76px; /* espaço para o botão hamburguer fixo */
  }
`;

// Rotas que nunca mostram a Sidebar, mesmo que autenticado — cobre
// especificamente a janela do fluxo "aceitar convite com conta existente"
// (Login.jsx), onde `autenticado` já vira true um instante antes do
// navigate("/dashboard") disparar. Sem essa checagem por rota, a Sidebar
// "piscaria" atrás do card de login nesse intervalo.
// Também cobre as telas da Fase 8.1 (verificação de e-mail): o usuário já
// está `autenticado` (tem token) ao ver /confirme-seu-email, mas ainda não
// deve ver a navegação completa do app — e /verificar-email é acessada por
// um link de e-mail, podendo ser aberta com uma sessão antiga já logada.
const PREFIXOS_ROTA_PUBLICA = ["/convites/"];
const ROTAS_PUBLICAS_EXATAS = [
  "/",
  "/registro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/confirme-seu-email",
  "/verificar-email",
];

function ehRotaPublica(pathname) {
  if (ROTAS_PUBLICAS_EXATAS.includes(pathname)) return true;
  return PREFIXOS_ROTA_PUBLICA.some((prefixo) => pathname.startsWith(prefixo));
}

// Monta a Sidebar (e o layout com ela) uma única vez, como irmão do
// <Routes> — não mais dentro de cada página via PageLayout. Antes, como
// cada página envolvia seu conteúdo em <PageLayout><Sidebar/>...</PageLayout>,
// trocar de rota desmontava e remontava a Sidebar inteira (e o
// OrganizationSwitcher/ProjectSwitcher dentro dela) a cada navegação.
export default function AppShell({ children }) {
  const { autenticado } = useAuth();
  const location = useLocation();

  if (!autenticado || ehRotaPublica(location.pathname)) {
    return children;
  }

  return (
    <Wrapper>
      <Sidebar />
      <Main>{children}</Main>
    </Wrapper>
  );
}