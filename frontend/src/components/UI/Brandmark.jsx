import styled from "styled-components";

const Mark = styled.svg`
  width: 1.05em;
  height: 1.05em;
  vertical-align: -0.18em;
  margin-right: 0.32em;
  color: ${({ theme }) => theme.primary};
`;

// Logomark do Kanban Pro: um pequeno favo de mel — 5 hexágonos lado a lado,
// cores sólidas e só 3 níveis de opacidade pra dar profundidade (sem
// gradiente, sem sombra, sem brilho/bevel 3D). O fundo usa currentColor
// (herda theme.primary, muda sozinho em claro/escuro); os hexágonos usam
// branco fixo, que mantém contraste nos dois temas. Sem clipPath de
// propósito: os hexágonos já cabem com folga dentro do quadrado — usar um
// clipPath com id fixo quebraria se este componente aparecer mais de uma
// vez na mesma página (Sidebar + título, por exemplo IDs duplicados no DOM).
export default function Brandmark({ className }) {
  return (
    <Mark
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="6" fill="currentColor" />

      <polygon points="10.32,9.10 8.65,12.00 5.30,12.00 3.62,9.10 5.30,6.20 8.65,6.20" fill="#FFFFFF" opacity="0.4" />
      <polygon points="10.32,14.90 8.65,17.80 5.30,17.80 3.62,14.90 5.30,12.00 8.65,12.00" fill="#FFFFFF" opacity="0.4" />
      <polygon points="15.35,12.00 13.68,14.90 10.33,14.90 8.65,12.00 10.32,9.10 13.68,9.10" fill="#FFFFFF" />
      <polygon points="20.38,9.10 18.70,12.00 15.35,12.00 13.67,9.10 15.35,6.20 18.70,6.20" fill="#FFFFFF" opacity="0.65" />
      <polygon points="20.38,14.90 18.70,17.80 15.35,17.80 13.67,14.90 15.35,12.00 18.70,12.00" fill="#FFFFFF" opacity="0.65" />
    </Mark>
  );
}