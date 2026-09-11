import { useEffect, useRef, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { FiCalendar, FiAlertCircle, FiAlignLeft } from "react-icons/fi";
import styled from "styled-components";
import Badge from "./UI/Badge";
import {
  CardContainer,
  GlowOverlay,
  CheckIcon,
  ParticulasContainer,
  Particula,
} from "../styles/DashboardStyles";
import { formatarData, estaAtrasado } from "../utils/formatters";

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
`;

const Badges = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const DataPrazo = styled.small`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${({ $atrasado, theme }) => ($atrasado ? "#ef4444" : theme.text)};
  opacity: ${({ $atrasado }) => ($atrasado ? 1 : 0.6)};
  font-size: 12px;
`;

// Ícone indicando que o card tem descrição — o texto só aparece ao clicar,
// igual ao badge de descrição do Trello (não fica exposto no card).
const DescricaoToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  padding: 2px 4px;
  margin: 0;
  border-radius: 4px;
  color: ${({ theme }) => theme.text};
  opacity: 0.6;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    opacity: 1;
    background: ${({ theme }) => theme.border};
  }
`;

const DescricaoPopover = styled.div`
  position: absolute;
  left: 10px;
  right: 10px;
  top: 100%;
  margin-top: 6px;
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 6px 16px ${({ theme }) => theme.shadow};
  z-index: 5;
`;

export default function Card({ card, index, onEditar, animando, onAnimacaoFim }) {
  const atrasado = estaAtrasado(card.prazo);
  const [mostrarDescricao, setMostrarDescricao] = useState(false);
  const wrapperRef = useRef(null);

  // Fecha o popover ao clicar fora do card.
  useEffect(() => {
    if (!mostrarDescricao) return;
    function aoClicarFora(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMostrarDescricao(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [mostrarDescricao]);

  function alternarDescricao(e) {
    e.stopPropagation(); // não abre o modal de edição do card
    setMostrarDescricao((prev) => !prev);
  }

  return (
    <Draggable draggableId={String(card.id)} index={index}>
      {(provided) => (
        <CardContainer
          ref={(node) => {
            provided.innerRef(node);
            wrapperRef.current = node;
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          onClick={() => onEditar(card)}
          $completou={animando}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) onAnimacaoFim?.(card.id);
          }}
        >
          <strong style={{ fontSize: 14 }}>{card.titulo}</strong>

          <CardFooter>
            <Badges>
              <Badge prioridade={card.prioridade} />

              {card.descricao && (
                <DescricaoToggle
                  type="button"
                  onClick={alternarDescricao}
                  aria-expanded={mostrarDescricao}
                  aria-label={mostrarDescricao ? "Ocultar descrição" : "Mostrar descrição"}
                >
                  <FiAlignLeft size={12} />
                </DescricaoToggle>
              )}
            </Badges>

            {card.prazo && (
              <DataPrazo $atrasado={atrasado}>
                {atrasado ? <FiAlertCircle size={12} /> : <FiCalendar size={12} />}
                {formatarData(card.prazo)}
              </DataPrazo>
            )}
          </CardFooter>

          {mostrarDescricao && card.descricao && (
            <DescricaoPopover onClick={(e) => e.stopPropagation()}>
              {card.descricao}
            </DescricaoPopover>
          )}

          {animando && (
            <>
              <GlowOverlay />
              <CheckIcon>✓</CheckIcon>
              <ParticulasContainer>
                <Particula />
                <Particula />
                <Particula />
                <Particula />
                <Particula />
              </ParticulasContainer>
            </>
          )}
        </CardContainer>
      )}
    </Draggable>
  );
}