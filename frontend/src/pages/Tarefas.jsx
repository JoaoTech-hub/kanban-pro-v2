import { useState } from "react";
import styled from "styled-components";
import { FiTrash2, FiEdit2, FiFilter } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import CardFormModal from "../components/CardFormModal";
import Badge from "../components/UI/Badge";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useKanban } from "../context/KanbanContext";
import api from "../services/api";
import { formatarData, estaAtrasado } from "../utils/formatters";

// ── Styled (inalterado) ──────────────────────────────────────────────────────

const Toolbar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
`;

const Filtro = styled.select`
  padding: 9px 14px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  outline: none;
  cursor: pointer;

  &:focus { border-color: ${({ theme }) => theme.primary}; }
`;

const BuscaInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  outline: none;

  &:focus { border-color: ${({ theme }) => theme.primary}; }
  &::placeholder { opacity: 0.5; }
`;

const Tabela = styled.div`
  background: ${({ theme }) => theme.card};
  border-radius: 16px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  overflow: hidden;
  overflow-x: auto;
`;

const Linha = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  color: ${({ theme }) => theme.text};
  min-width: 560px;

  &:last-child { border-bottom: none; }

  &:first-child {
    background: ${({ theme }) => theme.background};
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    opacity: 0.6;
    letter-spacing: 0.5px;
  }
`;

const Titulo = styled.span`
  font-weight: 600;
  font-size: 14px;
`;

const Prazo = styled.span`
  font-size: 13px;
  color: ${({ $atrasado, theme }) => $atrasado ? "#ef4444" : theme.text};
  opacity: ${({ $atrasado }) => $atrasado ? 1 : 0.7};
`;

const Coluna = styled.span`
  font-size: 13px;
  opacity: 0.7;
`;

const AcoesLinha = styled.div`
  display: flex;
  gap: 6px;
`;

const IconeBtn = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text};
  opacity: 0.4;
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  display: flex;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
    color: ${({ $danger }) => $danger ? "#ef4444" : "inherit"};
  }
`;

const Vazio = styled.div`
  padding: 48px;
  text-align: center;
  opacity: 0.4;
  color: ${({ theme }) => theme.text};
  font-size: 15px;
`;

const Contagem = styled.span`
  font-size: 13px;
  opacity: 0.5;
  color: ${({ theme }) => theme.text};
  margin-left: auto;
`;

// ── Componente ────────────────────────────────────────────────────────────────

export default function Tarefas() {
  const { organizationId } = useAuth();
  const { projectId, carregando: carregandoProjeto, erro: erroProjeto } = useProject();

  const { cards, colunas, setCards, carregouAoMenosUmaVez } = useKanban();

  const [busca, setBusca] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroColuna, setFiltroColuna] = useState("");
  const [cardEditando, setCardEditando] = useState(null);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [cardExcluir, setCardExcluir] = useState(null);

  const base = `/organizations/${organizationId}/projects/${projectId}`;

  function abrirExcluir(card) {
    setCardExcluir(card);
    setModalExcluir(true);
  }

  async function confirmarExcluir() {
    if (!cardExcluir) return;
    await api.delete(`${base}/cards/${cardExcluir.id}`);
    setCards((prev) => prev.filter((c) => c.id !== cardExcluir.id));
    setModalExcluir(false);
    setCardExcluir(null);
  }

  function cancelarExcluir() {
    setModalExcluir(false);
    setCardExcluir(null);
  }

  function aoAtualizarCard(cardAtualizado) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardAtualizado.id ? { ...cardAtualizado, coluna_id: cardAtualizado.colunaId } : c
      )
    );
  }

  const nomeDaColuna = (id) => colunas.find((c) => c.id === id)?.titulo ?? "—";

  const filtrados = cards.filter((c) => {
    const matchBusca = c.titulo.toLowerCase().includes(busca.toLowerCase());
    const matchPrioridade = !filtroPrioridade || c.prioridade === filtroPrioridade;
    const matchColuna = !filtroColuna || String(c.coluna_id) === filtroColuna;
    return matchBusca && matchPrioridade && matchColuna;
  });

  if (erroProjeto) {
    return (
      <PageLayout titulo="Tarefas">
        <p style={{ color: "#ef4444" }} role="alert">
          {erroProjeto}
        </p>
      </PageLayout>
    );
  }

  // Mesmo raciocínio de Dashboard.jsx/Projetos.jsx.
  const semDadoAinda =
    carregandoProjeto || (!carregouAoMenosUmaVez && cards.length === 0 && colunas.length === 0);

  return (
    <PageLayout titulo="Tarefas" subtitulo="Visualize e gerencie todas as suas tarefas">
      {semDadoAinda ? (
        <p>Carregando...</p>
      ) : (
        <>
          <Toolbar>
            <FiFilter size={16} style={{ opacity: 0.5 }} />
            <BuscaInput
              placeholder="Buscar tarefa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <Filtro value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
              <option value="">Todas as prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Filtro>

            <Filtro value={filtroColuna} onChange={(e) => setFiltroColuna(e.target.value)}>
              <option value="">Todas as colunas</option>
              {colunas.map((c) => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </Filtro>

            <Contagem>{filtrados.length} tarefa{filtrados.length !== 1 ? "s" : ""}</Contagem>
          </Toolbar>

          <Tabela>
            <Linha>
              <span>Título</span>
              <span>Prioridade</span>
              <span>Prazo</span>
              <span>Coluna</span>
              <span>Ações</span>
            </Linha>

            {filtrados.length === 0 && (
              <Vazio>Nenhuma tarefa encontrada.</Vazio>
            )}

            {filtrados.map((card) => (
              <Linha key={card.id}>
                <Titulo>{card.titulo}</Titulo>

                <Badge prioridade={card.prioridade} />

                <Prazo $atrasado={estaAtrasado(card.prazo)}>
                  {card.prazo ? formatarData(card.prazo) : "—"}
                </Prazo>

                <Coluna>{nomeDaColuna(card.coluna_id)}</Coluna>

                <AcoesLinha>
                  <IconeBtn
                    onClick={() => setCardEditando(card)}
                    title="Editar"
                    aria-label={`Editar tarefa ${card.titulo}`}
                  >
                    <FiEdit2 size={15} />
                  </IconeBtn>

                  <IconeBtn
                    $danger
                    onClick={() => abrirExcluir(card)}
                    title="Excluir"
                    aria-label={`Excluir tarefa ${card.titulo}`}
                  >
                    <FiTrash2 size={15} />
                  </IconeBtn>
                </AcoesLinha>
              </Linha>
            ))}
          </Tabela>
        </>
      )}

      {cardEditando && (
        <CardFormModal
          key={cardEditando.id}
          fechar={() => setCardEditando(null)}
          card={cardEditando}
          colunas={colunas}
          organizationId={organizationId}
          projectId={projectId}
          aoCriar={() => {}}
          aoAtualizar={aoAtualizarCard}
          aoExcluir={(id) => setCards((prev) => prev.filter((c) => c.id !== id))}
        />
      )}

      <ConfirmModal
        aberto={modalExcluir}
        titulo="Excluir tarefa"
        mensagem={
          cardExcluir
            ? `Deseja realmente excluir "${cardExcluir.titulo}"?\n\nEsta ação não poderá ser desfeita.`
            : ""
        }
        confirmar={confirmarExcluir}
        cancelar={cancelarExcluir}
      />
    </PageLayout>
  );
}