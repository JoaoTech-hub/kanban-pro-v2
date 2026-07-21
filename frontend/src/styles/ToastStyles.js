import styled, { keyframes } from "styled-components";

const entrar = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const sair = keyframes`
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-8px); }
`;

// Cor de destaque (borda + ícone) por tipo de toast.
const corPorTipo = {
  sucesso: "#22c55e",
  erro: "#ef4444",
  info: "#2563eb",
};

export const ToastViewport = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 340px;
  width: 100%;
  pointer-events: none;

  @media (max-width: 480px) {
    left: 16px;
    right: 16px;
    max-width: none;
    top: 16px;
  }
`;

export const ToastItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  border-left: 4px solid ${({ $tipo }) => corPorTipo[$tipo] || corPorTipo.info};
  padding: 14px 16px;
  border-radius: 10px;
  box-shadow: 0 8px 24px ${({ theme }) => theme.shadow};
  font-size: 14px;
  line-height: 1.4;
  cursor: pointer;
  pointer-events: auto;
  animation: ${({ $saindo }) => ($saindo ? sair : entrar)} 0.2s ease forwards;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
    color: ${({ $tipo }) => corPorTipo[$tipo] || corPorTipo.info};
  }
`;

export const ToastMensagem = styled.span`
  flex: 1;
  word-break: break-word;
`;