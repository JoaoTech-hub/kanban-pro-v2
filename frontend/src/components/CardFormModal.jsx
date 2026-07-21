import { useEffect, useState } from "react";
import api from "../services/api";
import {
  Overlay,
  ModalContainer,
  Footer,
} from "../styles/ModalStyles";
import Button from "./UI/Button";
import StyledInput from "./UI/Input";
import StyledSelect from "./UI/Select";
import StyledTextarea from "./UI/Textarea";
import ConfirmModal from "./ConfirmModal";

const ESTADO_INICIAL = {
  titulo: "",
  descricao: "",
  prioridade: "media",
  prazo: "",
  colunaId: "",
};

/**
 * Modal único de criação/edição de tarefa.
 * - Sem prop `card` (ou `card` null/undefined): modo criação.
 * - Com prop `card` preenchida: modo edição (mostra também o botão Excluir).
 *
 * Em vez de recarregar toda a lista de cards depois de salvar (o que pagava
 * o custo de latência do banco duas vezes), o modal recebe callbacks
 * (aoCriar/aoAtualizar/aoExcluir) e atualiza o estado do Dashboard direto
 * com o que a própria API já devolveu na resposta do POST/PATCH/DELETE.
 */
export default function CardFormModal({
  fechar,
  card,
  colunas,
  organizationId,
  projectId,
  aoCriar,
  aoAtualizar,
  aoExcluir,
}) {
  const editando = Boolean(card);
  const base = `/organizations/${organizationId}/projects/${projectId}`;

  const [form, setForm] = useState(() =>
    card
      ? {
          titulo: card.titulo,
          descricao: card.descricao || "",
          prioridade: card.prioridade || "media",
          prazo: card.prazo || "",
          colunaId: card.coluna_id,
        }
      : ESTADO_INICIAL
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [modalExcluir, setModalExcluir] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") fechar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fechar]);

  function atualizarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.colunaId) {
      setErro("Preencha o título e selecione uma coluna.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        prioridade: form.prioridade,
        colunaId: form.colunaId,
        prazo: form.prazo || null,
      };

      if (editando) {
        const resposta = await api.patch(`${base}/cards/${card.id}`, payload);
        aoAtualizar(resposta.data);
      } else {
        const resposta = await api.post(`${base}/cards`, payload);
        aoCriar(resposta.data);
      }

      fechar();
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao salvar a tarefa.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExcluir() {
    try {
      await api.delete(`${base}/cards/${card.id}`);
      aoExcluir(card.id);
      setModalExcluir(false);
      fechar();
    } catch {
      setErro("Erro ao excluir tarefa.");
      setModalExcluir(false);
    }
  }

  return (
    <Overlay onClick={fechar}>
      <ModalContainer
        role="dialog"
        aria-modal="true"
        aria-label={editando ? "Editar tarefa" : "Nova tarefa"}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0 }}>{editando ? "Editar tarefa" : "Nova tarefa"}</h2>

        <StyledInput
          placeholder="Título *"
          value={form.titulo}
          onChange={(e) => atualizarCampo("titulo", e.target.value)}
          autoFocus
        />

        <StyledTextarea
          placeholder="Descrição (opcional)"
          value={form.descricao}
          onChange={(e) => atualizarCampo("descricao", e.target.value)}
          rows={4}
        />

        <StyledSelect
          value={form.prioridade}
          onChange={(e) => atualizarCampo("prioridade", e.target.value)}
        >
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </StyledSelect>

        <StyledInput
          type="date"
          value={form.prazo}
          onChange={(e) => atualizarCampo("prazo", e.target.value)}
        />

        <StyledSelect
          value={form.colunaId}
          onChange={(e) => atualizarCampo("colunaId", e.target.value)}
        >
          {!editando && <option value="">Selecione uma coluna *</option>}
          {colunas.map((coluna) => (
            <option key={coluna.id} value={coluna.id}>
              {coluna.titulo}
            </option>
          ))}
        </StyledSelect>

        {erro && (
          <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }} role="alert">
            {erro}
          </p>
        )}

        <Footer style={editando ? { justifyContent: "space-between" } : undefined}>
          {editando && (
            <Button danger onClick={() => setModalExcluir(true)}>
              Excluir
            </Button>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Button secondary onClick={fechar}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </Footer>
      </ModalContainer>

      {editando && (
        <ConfirmModal
          aberto={modalExcluir}
          titulo="Excluir tarefa"
          mensagem={`Deseja realmente excluir "${card.titulo}"?\n\nEsta ação não poderá ser desfeita.`}
          confirmar={confirmarExcluir}
          cancelar={() => setModalExcluir(false)}
        />
      )}
    </Overlay>
  );
}