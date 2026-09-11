import styled from "styled-components";
import { labelPrioridade } from "../../utils/formatters";

const cores = {
  alta: "#C0392B",
  media: "#B4791F",
  baixa: "#3F8F4F",
};

const StyledBadge = styled.span`
  background: ${({ $prioridade }) => `${cores[$prioridade] || "#6b7280"}1A`};
  color: ${({ $prioridade }) => cores[$prioridade] || "#6b7280"};
  border: 1px solid ${({ $prioridade }) => `${cores[$prioridade] || "#6b7280"}55`};
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
`;

export default function Badge({ prioridade }) {
  return (
    <StyledBadge $prioridade={prioridade}>
      {labelPrioridade(prioridade)}
    </StyledBadge>
  );
}