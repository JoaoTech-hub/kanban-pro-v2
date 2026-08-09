import { useState, useMemo } from "react";
import styled from "styled-components";
import { FiTrash2, FiPlus, FiLayers, FiFolder } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ConfirmModal from "../components/ConfirmModal";
import { useProject } from "../context/ProjectContext";
import { useKanban } from "../context/KanbanContext";

// ── Styled components (inalterado) ──────────────────────────────────────────

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const ProjetoCard = styled.div`
  background: ${({ theme }) => theme.card};
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: transform 0.15s;

  &:hover {
    transform: translateY(-3px);
  }
`;

const ProjetoHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const ProjetoTitulo = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.text};
`;

const IconeBtn = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text};
  opacity: 0.4;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
    color: #ef4444;
  }
`;

const Stat = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.text};
  opacity: 0.7;
`;

const BarraFundo = styled.div`
  height: 6px;
  background: ${({ theme }) => theme.border};
  border-radius: 3px;
  overflow: hidden;
`;

const BarraProgresso = styled.div`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ theme }) => theme.primary};
  border-radius: 3px;
  transition: width 0.4s ease;
`;

const PctLabel = styled.span`
  font-size: 12px;
  opacity: 0.6;
  color: ${({ theme }) => theme.text};
`;

const ProgressoHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const AddCard = styled.button`
  background: transparent;
  border: 2px dashed ${({ theme }) => theme.border};
  border-radius: 16px;
  padding: 32px;
  cursor: pointer;
  color: ${({ theme }) => theme.text};
  opacity: 0.5;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.15s, border-color 0.15s;

  &:hover {
    opacity: 1;
    border-color: ${({ theme }) => theme.primary};
  }
`;

const InputNome = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1.5px solid ${({ theme }) => theme.primary};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 8px;
`;

const Acoes = styled.div`
  display: flex;
  gap: 8px;
`;

const BtnConfirmar = styled.button`
  background: ${({ theme }) => theme.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const BtnCancelar = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.text};
  border: 1px solid ${({ theme }) => theme.border};
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const EstadoVazio = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  color: ${({ theme }) => theme.text};
  opacity: 0.5;
  text-align: center;
  grid-column: 1 / -1;

  svg {
    opacity: 0.7;
  }
`;

// ── Componente ────────────────────────────────────────────────────────────────

export default function Projetos() {
  const { carregando: carregandoProjeto, erro: erroProjeto } = useProject();

  const { cards, colunas, criarColuna, excluirColuna, salvando, carregouAoMenosUmaVez } =
    useKanban();

  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [modalExcluir, setModalExcluir] = useState(false);
  const [projetoExcluir, setProjetoExcluir] = useState(null);

  const cardsPorColuna = useMemo(() => {
    const mapa = {};
    for (const card of cards) {
      (mapa[card.coluna_id] ??= []).push(card);
    }
    return mapa;
  }, [cards]);

  function calcularProgresso(coluna) {
    const total = cardsPorColuna[coluna.id]?.length ?? 0;
    if (total === 0) return { total, pct: 0 };
    const eConcluida = coluna.titulo?.toLowerCase().includes("conclu");
    const concluidos = eConcluida ? total : 0;
    return { total, pct: Math.round((concluidos / total) * 100) };
  }

  function abrirExclusao(coluna, total) {
    setProjetoExcluir({ id: coluna.id, titulo: coluna.titulo, qtd: total });
    setModalExcluir(true);
  }

  async function confirmarExcluirColuna() {
    if (!projetoExcluir) return;
    await excluirColuna(projetoExcluir.id);
    setModalExcluir(false);
    setProjetoExcluir(null);
  }

  function cancelarExcluirColuna() {
    setModalExcluir(false);
    setProjetoExcluir(null);
  }

  async function criarProjeto() {
    if (!novoNome.trim()) return;
    const ok = await criarColuna(novoNome.trim());
    if (ok) {
      setNovoNome("");
      setCriando(false);
    }
  }

  if (erroProjeto) {
    return (
      <PageLayout titulo="Colunas">
        <p style={{ color: "#ef4444" }} role="alert">
          {erroProjeto}
        </p>
      </PageLayout>
    );
  }

  // Mesmo raciocínio de Dashboard.jsx: só true na primeira visita de
  // verdade (sem dado ainda). Em revisitas o dado já está em memória, e
  // renderizar dentro da MESMA árvore (em vez de um `return` separado)
  // evita o flash de "Carregando..." que a troca de árvore causava.
  const semDadoAinda = carregandoProjeto || (!carregouAoMenosUmaVez && colunas.length === 0);

  return (
    <PageLayout titulo="Colunas" subtitulo="Organize as colunas do quadro atual">
      {semDadoAinda ? (
        <p>Carregando...</p>
      ) : (
        <Grid>
          {colunas.length === 0 && !criando && (
            <EstadoVazio>
              <FiFolder size={28} />
              Você ainda não tem colunas. Crie a primeira para começar.
            </EstadoVazio>
          )}

          {colunas.map((coluna) => {
            const { total, pct } = calcularProgresso(coluna);
            return (
              <ProjetoCard key={coluna.id}>
                <ProjetoHeader>
                  <ProjetoTitulo>{coluna.titulo}</ProjetoTitulo>
                  <IconeBtn
                    onClick={() => abrirExclusao(coluna, total)}
                    title="Excluir coluna"
                    aria-label={`Excluir coluna ${coluna.titulo}`}
                  >
                    <FiTrash2 size={16} />
                  </IconeBtn>
                </ProjetoHeader>

                <Stat>
                  <FiLayers size={14} />
                  {total} tarefa{total !== 1 ? "s" : ""}
                </Stat>

                <div>
                  <ProgressoHeader>
                    <PctLabel>Progresso</PctLabel>
                    <PctLabel>{pct}%</PctLabel>
                  </ProgressoHeader>
                  <BarraFundo>
                    <BarraProgresso $pct={pct} />
                  </BarraFundo>
                </div>
              </ProjetoCard>
            );
          })}

          {criando ? (
            <ProjetoCard>
              <ProjetoTitulo>Nova coluna</ProjetoTitulo>
              <InputNome
                autoFocus
                placeholder="Nome da coluna"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarProjeto();
                  if (e.key === "Escape") setCriando(false);
                }}
              />
              <Acoes>
                <BtnConfirmar onClick={criarProjeto} disabled={salvando || !novoNome.trim()}>
                  Criar
                </BtnConfirmar>
                <BtnCancelar onClick={() => setCriando(false)}>Cancelar</BtnCancelar>
              </Acoes>
            </ProjetoCard>
          ) : (
            <AddCard onClick={() => setCriando(true)}>
              <FiPlus size={18} />
              Nova coluna
            </AddCard>
          )}
        </Grid>
      )}

      <ConfirmModal
        aberto={modalExcluir}
        titulo="Excluir coluna"
        mensagem={
          projetoExcluir
            ? projetoExcluir.qtd > 0
              ? `A coluna "${projetoExcluir.titulo}" possui ${projetoExcluir.qtd} tarefa(s). Todas elas serão excluídas. Deseja continuar?`
              : `Deseja realmente excluir a coluna "${projetoExcluir.titulo}"?`
            : ""
        }
        confirmar={confirmarExcluirColuna}
        cancelar={cancelarExcluirColuna}
      />
    </PageLayout>
  );
}