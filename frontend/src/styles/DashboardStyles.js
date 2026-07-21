import styled, { keyframes, css } from "styled-components";

// overflow-x: auto impede quebra de layout quando há muitas colunas
export const ColumnsContainer = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 25px;
  overflow-x: auto;
  padding-bottom: 16px; /* espaço para scrollbar */

  /* Scrollbar sutil */
  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.border};
    border-radius: 3px;
  }

  @media (max-width: 480px) {
    gap: 12px;
  }
`;

// Mensagem exibida dentro de uma coluna sem nenhum card, para que o
// quadro nunca pareça "quebrado" ou incompleto quando está vazio.
export const EmptyColumnMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 24px 12px;
  border: 1.5px dashed ${({ theme }) => theme.border};
  border-radius: 10px;
  color: ${({ theme }) => theme.text};
  opacity: 0.45;
  font-size: 13px;
  text-align: center;

  svg {
    opacity: 0.7;
  }
`;

export const ColumnContainer = styled.div`
  flex: 0 0 300px; /* largura fixa para permitir scroll horizontal */
  background: ${({ theme, $isDraggingOver }) =>
    $isDraggingOver ? theme.border : theme.column};
  border-radius: 15px;
  padding: 20px;
  min-height: 500px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  transition: background 0.15s;

  @media (max-width: 480px) {
    flex-basis: 82vw;
    padding: 16px;
  }
`;

export const CardContainer = styled.div`
  position: relative;
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  padding: 15px;
  margin-top: 12px;
  border-radius: 12px;
  transition: transform 0.15s, box-shadow 0.15s;
  cursor: pointer;
  box-shadow: 0 2px 6px ${({ theme }) => theme.shadow};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px ${({ theme }) => theme.shadow};
  }

  &:first-child {
    margin-top: 12px;
  }

  ${({ $completou }) =>
    $completou &&
    css`
      animation: ${pulseEscala} 700ms ease;
    `}
`;

/* ---------------------------------------------------------------------- */
/* Animação de conclusão: disparada quando um card entra na coluna        */
/* "Concluído".                                                           */
/* ---------------------------------------------------------------------- */

const pulseEscala = keyframes`
  0% { transform: scale(1); }
  35% { transform: scale(1.08); }
  70% { transform: scale(1); }
  100% { transform: scale(1); }
`;

const apareceGlow = keyframes`
  0% { opacity: 0; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  30% { opacity: 1; box-shadow: 0 0 18px 6px rgba(34, 197, 94, 0.55); }
  70% { opacity: 1; box-shadow: 0 0 14px 4px rgba(34, 197, 94, 0.35); }
  100% { opacity: 0; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
`;

const apareceCheck = keyframes`
  0% { opacity: 0; transform: scale(0.5); }
  30% { opacity: 1; transform: scale(1.15); }
  55% { transform: scale(1); }
  85% { opacity: 1; }
  100% { opacity: 0; transform: scale(0.8); }
`;

const subirParticula = keyframes`
  0% { opacity: 0; transform: translateY(0) scale(0.6); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-46px) scale(1); }
`;

export const GlowOverlay = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  animation: ${apareceGlow} 700ms ease;
`;

export const CheckIcon = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
  animation: ${apareceCheck} 700ms ease;
`;

export const ParticulasContainer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
`;

export const Particula = styled.span`
  position: absolute;
  bottom: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  opacity: 0;
  animation: ${subirParticula} 650ms ease-out forwards;

  &:nth-child(1) { left: 15%; animation-delay: 0ms; }
  &:nth-child(2) { left: 32%; animation-delay: 60ms; }
  &:nth-child(3) { left: 50%; animation-delay: 30ms; }
  &:nth-child(4) { left: 68%; animation-delay: 90ms; }
  &:nth-child(5) { left: 85%; animation-delay: 45ms; }
`;