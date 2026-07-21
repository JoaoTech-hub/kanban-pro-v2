import styled from "styled-components";
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

const PageTitle = styled.h1`
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 700;
  color: ${({ theme }) => theme.text};

  @media (max-width: 480px) {
    font-size: 22px;
  }
`;

const PageSubtitle = styled.p`
  margin: 0 0 32px;
  opacity: 0.55;
  font-size: 14px;
  color: ${({ theme }) => theme.text};
`;

export default function PageLayout({
  titulo,
  subtitulo,
  children,
}) {
  return (
    <Wrapper>

      <Sidebar />

      <Main>

        {titulo && (
          <PageTitle>
            {titulo}
          </PageTitle>
        )}

        {subtitulo && (
          <PageSubtitle>
            {subtitulo}
          </PageSubtitle>
        )}

        {children}

      </Main>

    </Wrapper>
  );
}