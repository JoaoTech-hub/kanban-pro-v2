import { useState } from "react";
import styled from "styled-components";
import { FiPlus, FiX } from "react-icons/fi";

const Wrapper = styled.div`
  flex: 0 0 280px;
`;

const AddButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 2px dashed ${({ theme }) => theme.border};
  border-radius: 15px;
  background: transparent;
  color: ${({ theme }) => theme.text};
  opacity: 0.6;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: opacity 0.15s, border-color 0.15s;

  &:hover {
    opacity: 1;
    border-color: ${({ theme }) => theme.primary};
  }
`;

const FormBox = styled.div`
  background: ${({ theme }) => theme.column};
  border-radius: 15px;
  padding: 16px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
`;

const TituloInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 10px;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }
`;

const Acoes = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ConfirmarButton = styled.button`
  background: ${({ theme }) => theme.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CancelarButton = styled.button`
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

export default function NovaColuna({ onCriar, salvando }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");

  async function confirmar() {
    if (!titulo.trim()) return;
    const ok = await onCriar(titulo.trim());
    if (ok) {
      setTitulo("");
      setAberto(false);
    }
  }

  function cancelar() {
    setTitulo("");
    setAberto(false);
  }

  return (
    <Wrapper>
      {aberto ? (
        <FormBox>
          <TituloInput
            autoFocus
            placeholder="Nome da coluna"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") cancelar();
            }}
          />
          <Acoes>
            <ConfirmarButton onClick={confirmar} disabled={salvando || !titulo.trim()}>
              Adicionar
            </ConfirmarButton>
            <CancelarButton onClick={cancelar} title="Cancelar">
              <FiX size={18} />
            </CancelarButton>
          </Acoes>
        </FormBox>
      ) : (
        <AddButton onClick={() => setAberto(true)}>
          <FiPlus size={16} />
          Nova coluna
        </AddButton>
      )}
    </Wrapper>
  );
}