import { useEffect } from "react";
import styled from "styled-components";
import { FiTrash2 } from "react-icons/fi";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
`;

const Box = styled.div`
  width: 420px;
  max-width: 90%;
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  border-radius: 18px;
  padding: 30px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.35);
  animation: aparecer 0.18s ease;

  @keyframes aparecer {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (max-width: 480px) {
    padding: 22px;
  }
`;

const Icone = styled.div`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: ${({ theme }) => theme.danger}22;
  color: ${({ theme }) => theme.danger};
  display: flex;
  justify-content: center;
  align-items: center;
  margin: auto;
`;

const Titulo = styled.h2`
  text-align: center;
  margin: 20px 0 10px;
`;

const Texto = styled.p`
  text-align: center;
  opacity: 0.7;
  line-height: 1.6;
  white-space: pre-line;
`;

const Footer = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 28px;
`;

const Botao = styled.button`
  flex: 1;
  border: none;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: 0.2s;

  background: ${({ $danger, theme }) => ($danger ? theme.danger : theme.background)};
  color: ${({ $danger, theme }) => ($danger ? "white" : theme.text)};

  &:hover {
    opacity: 0.9;
  }
`;

export default function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  confirmar,
  cancelar,
  textoConfirmar = "Excluir",
}) {
  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e) {
      if (e.key === "Escape") cancelar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aberto, cancelar]);

  if (!aberto) return null;

  return (
    <Overlay onClick={cancelar}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <Icone>
          <FiTrash2 size={34} />
        </Icone>

        <Titulo>{titulo}</Titulo>

        <Texto>{mensagem}</Texto>

        <Footer>
          <Botao onClick={cancelar}>Cancelar</Botao>
          <Botao $danger onClick={confirmar} autoFocus>
            {textoConfirmar}
          </Botao>
        </Footer>
      </Box>
    </Overlay>
  );
}