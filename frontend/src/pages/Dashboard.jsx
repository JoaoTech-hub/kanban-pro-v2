import { useMemo, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";

import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useKanban, normalizarCard } from "../context/KanbanContext";

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

  // Vem do KanbanContext (persistente, montado uma vez acima do <Routes>)
  // — não busca nada aqui. O Provider já cuida do fetch, chaveado em
  // organizationId+projectId, e mantém o estado entre navegações.
  const {
    cards,
    colunas,
    erro,
    moverCard,
    setCards,
    criarColuna,
    renomearColuna,
    excluirColuna,
    salvando,
    carregouAoMenosUmaVez,
  } = useKanban();

  const [cardSelecionado, setCardSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [cardAnimandoId, setCardAnimandoId] = useState(null);

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
    // Fonte de verdade da posição é o campo `ordem` (ver auditoria) — a
    // ordem de inserção no array `cards` não reflete necessariamente a
    // ordem real, principalmente depois de um drag-and-drop.
    for (const colunaId in mapa) {
      mapa[colunaId].sort((a, b) => a.ordem - b.ordem);
    }
    return mapa;
  }, [cards, pesquisa]);

  if (erroProjeto) {
    return (
      <PageLayout>
        <p style={{ color: "#ef4444" }} role="alert">
          {erroProjeto}
        </p>
      </PageLayout>
    );
  }

  // Só true quando realmente não existe dado ainda nesta sessão (primeira
  // visita, ou o project acabou de trocar). Em revisitas (Dashboard <-> outra
  // página <-> Dashboard), tanto carregandoProjeto quanto carregouAoMenosUmaVez
  // já estão corretos ANTES deste componente montar de novo — mas antes,
  // isso ficava em um `return` separado (uma árvore JSX inteiramente
  // diferente da árvore de conteúdo real). Trocar de árvore força o React a
  // desmontar uma e montar outra, o que causava um flash de "Carregando..."
  // por um ciclo de render mesmo com o dado já pronto. Mantendo tudo numa
  // única árvore (mesmo padrão de Equipe.jsx), não existe essa troca — só
  // o conteúdo interno da área do quadro muda.
  const semDadoAinda = carregandoProjeto || (!carregouAoMenosUmaVez && colunas.length === 0);

  return (
    <PageLayout>
      <Header pesquisa={pesquisa} setPesquisa={setPesquisa} abrirNovaTarefa={abrirNovaTarefa} />

      <Stats cards={cards} colunas={colunas} />

      {erro && (
        <p style={{ color: "#ef4444", marginTop: 20 }} role="alert">
          {erro}
        </p>
      )}

      {semDadoAinda ? (
        <p>Carregando seu quadro...</p>
      ) : (
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
      )}

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