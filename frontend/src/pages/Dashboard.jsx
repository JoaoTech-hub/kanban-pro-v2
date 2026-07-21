import { useEffect, useMemo, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";

import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useKanban, normalizarCard } from "../hooks/useKanban";
import { useColunas } from "../hooks/useColunas";

import PageLayout from "../components/PageLayout";
import Header from "../components/Header";
import Column from "../components/Column";
import NovaColuna from "../components/NovaColuna";
import CardFormModal from "../components/CardFormModal";
import Stats from "../components/Stats";

import { ColumnsContainer } from "../styles/DashboardStyles";

export default function Dashboard() {
  const { organizationId } = useAuth();
  const { projectId, carregando: carregandoProjeto, erro: erroProjeto } = useProject();

  const { cards, colunas, erro, carregar, moverCard, setCards, setColunas } = useKanban(
    organizationId,
    projectId
  );

  const { criarColuna, renomearColuna, excluirColuna, salvando } = useColunas(
    organizationId,
    projectId,
    { colunas, setColunas, setCards, carregar }
  );

  const [cardSelecionado, setCardSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [cardAnimandoId, setCardAnimandoId] = useState(null);

  useEffect(() => {
    if (projectId) carregar();
  }, [carregar, projectId]);

  async function onDragEnd(resultado) {
    if (!resultado.destination) return;

    // IDs agora são UUIDs (strings) — o código antigo convertia com Number(),
    // o que quebraria silenciosamente (viraria NaN) com o banco novo.
    const cardId = resultado.draggableId;
    const colunaOrigemId = resultado.source.droppableId;
    const colunaDestinoId = resultado.destination.droppableId;
    const ordemDestino = resultado.destination.index;

    if (colunaOrigemId !== colunaDestinoId) {
      const colunaDestino = colunas.find((c) => c.id === colunaDestinoId);
      const isDestinoConcluido = colunaDestino?.titulo.toLowerCase().includes("conclu");

      if (isDestinoConcluido) {
        setCardAnimandoId(cardId);
      }
    }

    await moverCard(cardId, colunaDestinoId, ordemDestino);
  }

  function limparAnimacao(cardId) {
    setCardAnimandoId((atual) => (atual === cardId ? null : atual));
  }

  function abrirEdicao(card) {
    setCardSelecionado(card);
    setModalAberto(true);
  }

  function abrirNovaTarefa() {
    setCardSelecionado(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setCardSelecionado(null);
  }

  // Callbacks otimistas: o modal já recebe o dado pronto da resposta da API
  // (POST/PATCH/DELETE), então atualizamos o estado local direto,
  // sem precisar recarregar tudo do zero (evita a "travada" de 2 chamadas).
  function aoCriarCard(novoCard) {
    setCards((prev) => [...prev, normalizarCard(novoCard)]);
  }

  function aoAtualizarCard(cardAtualizado) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardAtualizado.id ? normalizarCard(cardAtualizado) : c))
    );
  }

  function aoExcluirCard(id) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  const cardsPorColuna = useMemo(() => {
    const filtrados = cards.filter((card) =>
      card.titulo.toLowerCase().includes(pesquisa.toLowerCase())
    );
    const mapa = {};
    for (const card of filtrados) {
      (mapa[card.coluna_id] ??= []).push(card);
    }
    return mapa;
  }, [cards, pesquisa]);

  if (carregandoProjeto) {
    return (
      <PageLayout>
        <p>Carregando seu quadro...</p>
      </PageLayout>
    );
  }

  if (erroProjeto) {
    return (
      <PageLayout>
        <p style={{ color: "#ef4444" }} role="alert">
          {erroProjeto}
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Header pesquisa={pesquisa} setPesquisa={setPesquisa} abrirNovaTarefa={abrirNovaTarefa} />

      <Stats cards={cards} colunas={colunas} />

      {erro && (
        <p style={{ color: "#ef4444", marginTop: 20 }} role="alert">
          {erro}
        </p>
      )}

      <DragDropContext
        onDragEnd={onDragEnd}
        autoScrollerOptions={{
          startFromPercentage: 0.15,
          maxScrollAtPercentage: 0.05,
          maxPixelScroll: 28,
          durationDampening: { stopDampeningAt: 1200, accelerateAt: 360 },
        }}
      >
        <ColumnsContainer>
          {colunas.map((coluna) => (
            <Column
              key={coluna.id}
              coluna={coluna}
              cards={cardsPorColuna[coluna.id] ?? []}
              onEditar={abrirEdicao}
              onRenomear={renomearColuna}
              onExcluir={excluirColuna}
              cardAnimandoId={cardAnimandoId}
              onAnimacaoFim={limparAnimacao}
            />
          ))}

          <NovaColuna onCriar={criarColuna} salvando={salvando} />
        </ColumnsContainer>
      </DragDropContext>

      {modalAberto && (
        <CardFormModal
          key={cardSelecionado?.id ?? "novo"}
          fechar={fecharModal}
          card={cardSelecionado}
          colunas={colunas}
          organizationId={organizationId}
          projectId={projectId}
          aoCriar={aoCriarCard}
          aoAtualizar={aoAtualizarCard}
          aoExcluir={aoExcluirCard}
        />
      )}
    </PageLayout>
  );
}