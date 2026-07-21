import styled from "styled-components";
import { labelPrioridade } from "../../utils/formatters";

const cores = {
  alta: "#ef4444",
  media: "#eab308",
  baixa: "#22c55e",
};

const StyledBadge = styled.span`
  background: ${({ $prioridade }) => cores[$prioridade] || "#6b7280"};
  color: white;
  padding: 3px 10px;
  border-radius: 20px;
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
