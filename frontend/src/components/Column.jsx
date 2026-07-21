import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiInbox } from "react-icons/fi";
import styled from "styled-components";
import Card from "./Card";
import ConfirmModal from "./ConfirmModal";
import { ColumnContainer, EmptyColumnMessage } from "../styles/DashboardStyles";

const ColumnHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
`;

const ColumnTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Count = styled.span`
  font-size: 13px;
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  padding: 2px 10px;
  border-radius: 20px;
  opacity: 0.7;
  font-weight: 600;
  flex-shrink: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text};
  opacity: 0.5;
  cursor: pointer;
  padding: 4px;
  display: flex;
  border-radius: 6px;
  transition: opacity 0.15s, background 0.15s;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.background};
  }
`;

const TituloInput = styled.input`
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-bottom: 2px solid ${({ theme }) => theme.primary};
  background: transparent;
  color: ${({ theme }) => theme.text};
  outline: none;
  padding: 0 0 2px;
`;

export default function Column({
  coluna,
  cards,
  onEditar,
  onRenomear,
  onExcluir,
  cardAnimandoId,
  onAnimacaoFim
}) {

  const [editando, setEditando] = useState(false);
  const [tituloEditado, setTituloEditado] = useState(coluna.titulo);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);

  function iniciarEdicao() {
    setTituloEditado(coluna.titulo);
    setEditando(true);
  }

  async function confirmarEdicao() {
    if (!tituloEditado.trim() || tituloEditado.trim() === coluna.titulo) {
      setEditando(false);
      return;
    }
    const ok = await onRenomear(coluna.id, tituloEditado.trim());
    if (ok) setEditando(false);
  }

  function cancelarEdicao() {
    setEditando(false);
    setTituloEditado(coluna.titulo);
  }

  function handleExcluir() {
  setModalExcluirAberto(true);
}

  async function confirmarExcluir() {
    try {
      await onExcluir(coluna.id);
    } finally {
      setModalExcluirAberto(false);
    }
  }

  return (
    <Droppable droppableId={String(coluna.id)}>
      {(provided, snapshot) => (
        <ColumnContainer
          ref={provided.innerRef}
          {...provided.droppableProps}
          $isDraggingOver={snapshot.isDraggingOver}
        >
          <ColumnHeader>
            {editando ? (
              <>
                <TituloInput
                  autoFocus
                  value={tituloEditado}
                  onChange={(e) => setTituloEditado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmarEdicao();
                    if (e.key === "Escape") cancelarEdicao();
                  }}
                />
                <HeaderActions>
                  <IconButton onClick={confirmarEdicao} title="Salvar">
                    <FiCheck size={16} />
                  </IconButton>
                  <IconButton onClick={cancelarEdicao} title="Cancelar">
                    <FiX size={16} />
                  </IconButton>
                </HeaderActions>
              </>
            ) : (
              <>
                <ColumnTitle>{coluna.titulo}</ColumnTitle>
                <Count>{cards.length}</Count>
                <HeaderActions>
                  <IconButton onClick={iniciarEdicao} title="Renomear coluna">
                    <FiEdit2 size={14} />
                  </IconButton>
                  <IconButton onClick={handleExcluir} title="Excluir coluna">
                    <FiTrash2 size={14} />
                  </IconButton>
                </HeaderActions>
              </>
            )}
          </ColumnHeader>

          {cards.map((card, index) => (
            <Card
              key={card.id}
              card={card}
              index={index}
              onEditar={onEditar}
              animando={card.id === cardAnimandoId}
              onAnimacaoFim={onAnimacaoFim}
            />
          ))}

          {cards.length === 0 && (
            <EmptyColumnMessage>
              <FiInbox size={22} />
              Nenhuma tarefa aqui ainda.
            </EmptyColumnMessage>
          )}

          {provided.placeholder}

          <ConfirmModal
            aberto={modalExcluirAberto}
            titulo="Excluir coluna"
            mensagem={
              cards.length > 0
                ? `A coluna "${coluna.titulo}" possui ${cards.length} tarefa(s). Todas elas serão excluídas. Esta ação não poderá ser desfeita.`
                : `Deseja realmente excluir a coluna "${coluna.titulo}"?`
            }
            confirmar={confirmarExcluir}
            cancelar={() => setModalExcluirAberto(false)}
          />
        </ColumnContainer>
      )}
    </Droppable>
  );
}