import { useEffect, useState } from "react";
import styled from "styled-components";
import { FiEdit2 } from "react-icons/fi";

// Estrutura visual espelhada de ConfirmModal.jsx (mesmo Overlay/Box/Titulo/
// Footer, mesmo z-index, mesmo fechamento via Esc/clique-fora). Não
// reaproveitei o ConfirmModal diretamente porque ele é feito sob medida
// para exclusão (ícone de lixeira e botão "Excluir" fixos, sem campo de
// input) — misturar as duas coisas ali deixaria o componente mais confuso
// para os dois casos de uso.
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
  background: ${({ theme }) => theme.primary}22;
  color: ${({ theme }) => theme.primary};
  display: flex;
  justify-content: center;
  align-items: center;
  margin: auto;
`;

const Titulo = styled.h2`
  text-align: center;
  margin: 20px 0 16px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 15px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }
`;

const ErroTexto = styled.p`
  color: ${({ theme }) => theme.danger};
  font-size: 13px;
  margin: 8px 0 0;
  text-align: center;
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

  background: ${({ $primary, theme }) => ($primary ? theme.primary : theme.background)};
  color: ${({ $primary, theme }) => ($primary ? "white" : theme.text)};

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

export default function ProjectRenameModal({ aberto, nomeAtual, salvando, confirmar, cancelar }) {
  // Sem useEffect para "resetar" o campo ao abrir: o componente é montado
  // com uma key diferente a cada projeto (ver ProjectSwitcher.jsx), então o
  // useState abaixo já nasce com o valor certo sempre que abre para um
  // projeto novo — sem precisar sincronizar estado depois da montagem.
  const [nome, setNome] = useState(nomeAtual || "");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e) {
      if (e.key === "Escape") cancelar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aberto, cancelar]);

  if (!aberto) return null;

  function handleConfirmar() {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("O nome do quadro não pode ficar vazio.");
      return;
    }
    setErro("");
    confirmar(nomeLimpo);
  }

  return (
    <Overlay onClick={cancelar}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label="Renomear quadro"
        onClick={(e) => e.stopPropagation()}
      >
        <Icone>
          <FiEdit2 size={30} />
        </Icone>

        <Titulo>Renomear quadro</Titulo>

        <Input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirmar();
          }}
          maxLength={120}
          aria-label="Novo nome do quadro"
          disabled={salvando}
        />
        {erro && <ErroTexto role="alert">{erro}</ErroTexto>}

        <Footer>
          <Botao onClick={cancelar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao $primary onClick={handleConfirmar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Botao>
        </Footer>
      </Box>
    </Overlay>
  );
}