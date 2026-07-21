import { Draggable } from "@hello-pangea/dnd";
import { FiCalendar, FiAlertCircle } from "react-icons/fi";
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
  margin-top: 12px;
`;

const DataPrazo = styled.small`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${({ $atrasado, theme }) => ($atrasado ? "#ef4444" : theme.text)};
  opacity: ${({ $atrasado }) => ($atrasado ? 1 : 0.6)};
  font-size: 12px;
`;

const Descricao = styled.p`
  margin: 6px 0 0;
  font-size: 13px;
  opacity: 0.7;
  line-height: 1.4;
  /* Limita a 2 linhas para não inflar o card */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export default function Card({ card, index, onEditar, animando, onAnimacaoFim }) {
  const atrasado = estaAtrasado(card.prazo);

  return (
    <Draggable draggableId={String(card.id)} index={index}>
      {(provided) => (
        <CardContainer
          ref={provided.innerRef}
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

          {card.descricao && <Descricao>{card.descricao}</Descricao>}

          <CardFooter>
            <Badge prioridade={card.prioridade} />

            {card.prazo && (
              <DataPrazo $atrasado={atrasado}>
                {atrasado ? <FiAlertCircle size={12} /> : <FiCalendar size={12} />}
                {formatarData(card.prazo)}
              </DataPrazo>
            )}
          </CardFooter>
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
