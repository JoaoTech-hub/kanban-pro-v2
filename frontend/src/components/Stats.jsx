import {
  FiClipboard,
  FiClock,
  FiLoader,
  FiCheckCircle,
} from "react-icons/fi";

import { StatsContainer, StatCard } from "../styles/StatsStyles";

// Exibe o total de cards e a contagem por coluna, respeitando os nomes
// reais das colunas do usuário (se adapta a qualquer número de colunas).
const ICONES_PADRAO = [FiClock, FiLoader, FiCheckCircle];

export default function Stats({ cards, colunas }) {
  const total = cards.length;

  return (
    <StatsContainer>
      <StatCard>
        <FiClipboard size={24} />
        <h3>{total}</h3>
        <span>Total</span>
      </StatCard>

      {colunas.map((coluna, i) => {
        const Icone = ICONES_PADRAO[i] ?? FiClipboard;
        const quantidade = cards.filter((c) => c.coluna_id === coluna.id).length;
        return (
          <StatCard key={coluna.id}>
            <Icone size={24} />
            <h3>{quantidade}</h3>
            <span>{coluna.titulo}</span>
          </StatCard>
        );
      })}
    </StatsContainer>
  );
}
