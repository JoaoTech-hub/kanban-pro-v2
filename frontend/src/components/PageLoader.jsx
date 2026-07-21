import styled, { keyframes } from "styled-components";

const girar = keyframes`
  to { transform: rotate(360deg); }
`;

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${({ theme }) => theme.background};
`;

const Spinner = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.border};
  border-top-color: ${({ theme }) => theme.primary};
  animation: ${girar} 0.7s linear infinite;
`;

/**
 * Fallback usado pelo <Suspense> enquanto o chunk da rota (carregado
 * via React.lazy) é baixado. Aparece por poucos instantes na maioria
 * das conexões, mas evita uma tela em branco durante o carregamento.
 */
export default function PageLoader() {
  return (
    <Wrapper role="status" aria-label="Carregando página">
      <Spinner />
    </Wrapper>
  );
}