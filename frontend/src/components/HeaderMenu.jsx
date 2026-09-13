import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMoreVertical, FiMoon, FiSun, FiSettings, FiLogOut } from "react-icons/fi";
import styled from "styled-components";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useProject } from "../context/ProjectContext";
import { FUNDOS_QUADRO } from "../utils/boardBackgrounds";

const Wrapper = styled.div`
  position: relative;
`;

const GatilhoBotao = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  background: transparent;
  color: ${({ theme }) => theme.text};
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
  width: 220px;
`;

const SecaoTitulo = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const Grade = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 14px;
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

const Divisoria = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.border};
  margin: 4px 0 8px;
`;

const ItemMenu = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: none;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: ${({ $perigo, theme }) => ($perigo ? "#ef4444" : theme.text)};

  &:hover {
    background: ${({ theme }) => theme.column};
  }
`;

export default function HeaderMenu({ projeto }) {
  const { logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const { atualizarFundoProjeto } = useProject();
  const navigate = useNavigate();
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

  function escolherFundo(key) {
    if (projeto) atualizarFundoProjeto(projeto.id, key);
    setAberto(false);
  }

  return (
    <Wrapper ref={wrapperRef}>
      <GatilhoBotao
        type="button"
        onClick={() => setAberto((prev) => !prev)}
        title="Mais opções"
        aria-label="Mais opções"
        aria-expanded={aberto}
      >
        <FiMoreVertical size={18} />
      </GatilhoBotao>

      {aberto && (
        <Popover>
          {projeto && (
            <>
              <SecaoTitulo>Fundo do quadro</SecaoTitulo>
              <Grade>
                <SwatchPadrao
                  type="button"
                  title="Padrão"
                  aria-label="Fundo padrão"
                  $ativo={!projeto.background}
                  onClick={() => escolherFundo(null)}
                />
                {FUNDOS_QUADRO.map((fundo) => (
                  <Swatch
                    key={fundo.key}
                    type="button"
                    title={fundo.label}
                    aria-label={fundo.label}
                    $css={fundo.css}
                    $ativo={projeto.background === fundo.key}
                    onClick={() => escolherFundo(fundo.key)}
                  />
                ))}
              </Grade>
              <Divisoria />
            </>
          )}

          <ItemMenu type="button" onClick={toggleTheme}>
            {dark ? <FiSun size={16} /> : <FiMoon size={16} />}
            {dark ? "Modo claro" : "Modo escuro"}
          </ItemMenu>

          <ItemMenu
            type="button"
            onClick={() => {
              setAberto(false);
              navigate("/configuracoes");
            }}
          >
            <FiSettings size={16} />
            Configurações
          </ItemMenu>

          <Divisoria />

          <ItemMenu type="button" $perigo onClick={logout}>
            <FiLogOut size={16} />
            Sair
          </ItemMenu>
        </Popover>
      )}
    </Wrapper>
  );
}