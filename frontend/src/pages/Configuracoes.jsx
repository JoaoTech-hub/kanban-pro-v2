import styled from "styled-components";
import { FiMoon, FiSun, FiLayout, FiEye } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useTheme } from "../context/ThemeContext";

// ── Styled ────────────────────────────────────────────────────────────────────

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
  max-width: 800px;
`;

const Secao = styled.div`
  background: ${({ theme }) => theme.card};
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const SecaoHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${({ theme }) => theme.text};

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  svg {
    opacity: 0.6;
  }
`;

const OpcaoLinha = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid ${({ theme }) => theme.border};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const OpcaoInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const OpcaoTitulo = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.text};
`;

const OpcaoDesc = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.text};
  opacity: 0.55;
`;

const Toggle = styled.button`
  width: 52px;
  height: 28px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;
  background: ${({ $ativo, theme }) => $ativo ? theme.primary : theme.border};

  &::after {
    content: "";
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    top: 3px;
    left: ${({ $ativo }) => $ativo ? "27px" : "3px"};
    transition: left 0.25s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
`;

const TemaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const TemaCard = styled.button`
  padding: 16px;
  border-radius: 12px;
  border: 2px solid ${({ $ativo, theme }) => $ativo ? theme.primary : theme.border};
  background: ${({ $bg }) => $bg};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: border-color 0.2s, transform 0.15s;

  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => theme.primary};
  }
`;

const TemaLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ $cor }) => $cor};
`;

const Versao = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.text};
  opacity: 0.4;
  text-align: center;
  padding-top: 8px;
`;

// ── Componente ────────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const { dark, toggleTheme } = useTheme();

  return (
    <PageLayout titulo="Configurações" subtitulo="Personalize sua experiência no Kanban Pro">
      <Grid>
        {/* Aparência */}
        <Secao>
          <SecaoHeader>
            <FiEye size={18} />
            <h2>Aparência</h2>
          </SecaoHeader>

          <OpcaoLinha>
            <OpcaoInfo>
              <OpcaoTitulo>Modo escuro</OpcaoTitulo>
              <OpcaoDesc>Alterna entre tema claro e escuro</OpcaoDesc>
            </OpcaoInfo>
            <Toggle $ativo={dark} onClick={toggleTheme} title="Alternar tema" />
          </OpcaoLinha>

          <div>
            <OpcaoTitulo style={{ display: "block", marginBottom: 12 }}>Tema</OpcaoTitulo>
            <TemaGrid>
              <TemaCard
                $ativo={!dark}
                $bg="#f8fafc"
                onClick={() => dark && toggleTheme()}
              >
                <FiSun size={22} color="#1e293b" />
                <TemaLabel $cor="#1e293b">Claro</TemaLabel>
              </TemaCard>

              <TemaCard
                $ativo={dark}
                $bg="#111827"
                onClick={() => !dark && toggleTheme()}
              >
                <FiMoon size={22} color="#f9fafb" />
                <TemaLabel $cor="#f9fafb">Escuro</TemaLabel>
              </TemaCard>
            </TemaGrid>
          </div>
        </Secao>

        {/* Sobre */}
        <Secao>
          <SecaoHeader>
            <FiLayout size={18} />
            <h2>Sobre o app</h2>
          </SecaoHeader>

          <OpcaoLinha>
            <OpcaoInfo>
              <OpcaoTitulo>Aplicação</OpcaoTitulo>
              <OpcaoDesc>Kanban Pro</OpcaoDesc>
            </OpcaoInfo>
          </OpcaoLinha>

          <OpcaoLinha>
            <OpcaoInfo>
              <OpcaoTitulo>Versão</OpcaoTitulo>
              <OpcaoDesc>1.0.0</OpcaoDesc>
            </OpcaoInfo>
          </OpcaoLinha>

          <OpcaoLinha>
            <OpcaoInfo>
              <OpcaoTitulo>Stack</OpcaoTitulo>
              <OpcaoDesc>React 19 + Vite + Node.js + SQLite</OpcaoDesc>
            </OpcaoInfo>
          </OpcaoLinha>

          <OpcaoLinha>
            <OpcaoInfo>
              <OpcaoTitulo>Armazenamento</OpcaoTitulo>
              <OpcaoDesc>SQLite local (kanban.db)</OpcaoDesc>
            </OpcaoInfo>
          </OpcaoLinha>

          <Versao>Kanban Pro v1.0.0 · Desenvolvido com React + Node.js</Versao>
        </Secao>
      </Grid>
    </PageLayout>
  );
}