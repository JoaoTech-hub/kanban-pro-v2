import styled from "styled-components";

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

// Só o título/subtítulo/conteúdo — o Wrapper+Sidebar+Main que existia aqui
// antes agora é responsabilidade de AppShell.jsx, montado uma única vez
// acima do <Routes>. A API deste componente (props titulo/subtitulo/children)
// não muda — nenhuma página precisa alterar como chama <PageLayout>.
export default function PageLayout({ titulo, subtitulo, children }) {
  return (
    <>
      {titulo && <PageTitle>{titulo}</PageTitle>}
      {subtitulo && <PageSubtitle>{subtitulo}</PageSubtitle>}
      {children}
    </>
  );
}