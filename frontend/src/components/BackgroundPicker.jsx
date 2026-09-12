import { useEffect, useRef, useState } from "react";
import { FiDroplet } from "react-icons/fi";
import styled from "styled-components";
import { useProject } from "../context/ProjectContext";
import { FUNDOS_QUADRO } from "../utils/boardBackgrounds";

const Wrapper = styled.div`
  position: relative;
`;

const Popover = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 24px ${({ theme }) => theme.shadow};
  z-index: 20;
  width: 200px;
`;

const PopoverTitle = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const Grade = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
`;

const Swatch = styled.button`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  border: 2px solid ${({ theme, $ativo }) => ($ativo ? theme.primary : "transparent")};
  background: ${({ $css }) => $css};
  cursor: pointer;
  padding: 0;

  &:hover {
    opacity: 0.85;
  }
`;

const SwatchPadrao = styled.button`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  border: 2px solid ${({ theme, $ativo }) => ($ativo ? theme.primary : theme.border)};
  background: ${({ theme }) => theme.column};
  cursor: pointer;
  padding: 0;

  &:hover {
    opacity: 0.85;
  }
`;

export default function BackgroundPicker({ projeto }) {
  const { atualizarFundoProjeto } = useProject();
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  if (!projeto) return null;

  function escolher(key) {
    atualizarFundoProjeto(projeto.id, key);
    setAberto(false);
  }

  return (
    <Wrapper ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setAberto((prev) => !prev)}
        title="Alterar fundo do quadro"
        aria-label="Alterar fundo do quadro"
        aria-expanded={aberto}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          background: "transparent",
        }}
      >
        <FiDroplet size={18} />
      </button>

      {aberto && (
        <Popover>
          <PopoverTitle>Fundo do quadro</PopoverTitle>
          <Grade>
            <SwatchPadrao
              type="button"
              title="Padrão"
              aria-label="Fundo padrão"
              $ativo={!projeto.background}
              onClick={() => escolher(null)}
            />
            {FUNDOS_QUADRO.map((fundo) => (
              <Swatch
                key={fundo.key}
                type="button"
                title={fundo.label}
                aria-label={fundo.label}
                $css={fundo.css}
                $ativo={projeto.background === fundo.key}
                onClick={() => escolher(fundo.key)}
              />
            ))}
          </Grade>
        </Popover>
      )}
    </Wrapper>
  );
}