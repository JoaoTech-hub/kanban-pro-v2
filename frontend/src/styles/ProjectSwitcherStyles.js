import styled from "styled-components";

export const Wrapper = styled.div`
  position: relative;
  margin-bottom: 24px;
`;

export const Trigger = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > svg {
    flex-shrink: 0;
    transform: rotate(${({ $aberto }) => ($aberto ? "180deg" : "0")});
    transition: transform 0.15s;
  }

  &:hover {
    border-color: ${({ theme }) => theme.primary};
  }
`;

export const TriggerContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;

  svg {
    color: ${({ theme }) => theme.primary};
    flex-shrink: 0;
  }
`;

export const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 10px;
  box-shadow: 0 10px 30px ${({ theme }) => theme.shadow};
  padding: 6px;
  z-index: 50;
  max-height: 280px;
  overflow-y: auto;
`;

export const ProjetoItem = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 9px 6px 9px 10px;
  border: none;
  border-radius: 8px;
  background: ${({ $ativo, theme }) => ($ativo ? `${theme.primary}22` : "transparent")};
  color: ${({ theme }) => theme.text};
  font-size: 13.5px;
  font-weight: ${({ $ativo }) => ($ativo ? "600" : "500")};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.background};
  }
`;

export const ProjetoNome = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;

  svg {
    color: ${({ theme }) => theme.primary};
    flex-shrink: 0;
  }
`;

export const TipoBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: ${({ theme }) => theme.border}66;
  color: ${({ theme }) => theme.text};
  opacity: 0.85;
  flex-shrink: 0;

  svg {
    color: inherit;
    width: 11px;
    height: 11px;
  }
`;

export const MenuWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

export const MaisBotao = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.text};
  opacity: 0.45;
  cursor: pointer;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.background};
  }
`;

export const MenuOpcoes = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 8px;
  box-shadow: 0 10px 30px ${({ theme }) => theme.shadow};
  padding: 4px;
  z-index: 60;
  min-width: 140px;
`;

export const OpcaoMenu = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${({ $danger, theme }) => ($danger ? theme.danger : theme.text)};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${({ $danger, theme }) => ($danger ? `${theme.danger}18` : theme.background)};
  }
`;

export const Divisor = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.border};
  margin: 6px 2px;
`;

export const NovoProjetoButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: ${({ theme }) => theme.primary};
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background};
  }
`;

export const FormBox = styled.div`
  padding: 6px 4px 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const NomeInput = styled.input`
  width: 100%;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 13.5px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }
`;

export const TipoSelect = styled.select`
  width: 100%;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 13.5px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }
`;

export const Acoes = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export const ConfirmarButton = styled.button`
  flex: 1;
  background: ${({ theme }) => theme.primary};
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const CancelarButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text};
  opacity: 0.6;
  cursor: pointer;
  display: flex;
  padding: 8px;

  &:hover {
    opacity: 1;
  }
`;

export const ErroTexto = styled.p`
  color: ${({ theme }) => theme.danger};
  font-size: 12.5px;
  margin: 0;
  line-height: 1.4;
`;