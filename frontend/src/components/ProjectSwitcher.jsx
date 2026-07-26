import { useState } from "react";
import { 
  FiChevronDown, 
  FiPlus, 
  FiCheck, 
  FiX, 
  FiMoreVertical, 
  FiEdit2, 
  FiTrash2,
  FiCloud,
  FiSmartphone,
  FiPlay
} from "react-icons/fi";
import { useProject } from "../context/ProjectContext";
import ConfirmModal from "./ConfirmModal";
import ProjectRenameModal from "./ProjectRenameModal";
import {
  Wrapper,
  Trigger,
  TriggerContent,
  Dropdown,
  ProjetoItem,
  ProjetoNome,
  TipoBadge,
  MenuWrapper,
  MaisBotao,
  MenuOpcoes,
  OpcaoMenu,
  Divisor,
  NovoProjetoButton,
  FormBox,
  NomeInput,
  TipoSelect,
  Acoes,
  ConfirmarButton,
  CancelarButton,
  ErroTexto,
} from "../styles/ProjectSwitcherStyles";

const getTipoConfig = (tipo) => {
  switch (tipo) {
    case "app":
      return { label: "App", icone: <FiSmartphone /> };
    case "jogo":
      return { label: "Jogo", icone: <FiPlay /> };
    case "saas":
    default:
      return { label: "SaaS", icone: <FiCloud /> };
  }
};

export default function ProjectSwitcher() {
  const {
    projetos,
    projectId,
    carregando,
    selecionarProjeto,
    criarProjeto,
    excluirProjeto,
    renomearProjeto,
  } = useProject();

  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("saas");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [menuAbertoId, setMenuAbertoId] = useState(null); // qual item tem o menu de 3 pontos aberto
  const [paraExcluir, setParaExcluir] = useState(null); // projeto selecionado para confirmação de exclusão
  const [paraRenomear, setParaRenomear] = useState(null); // projeto selecionado para renomear
  const [salvandoRenome, setSalvandoRenome] = useState(false);

  // Garante um array seguro mesmo se "projetos" vier como undefined, null ou objeto
  const listaProjetos = Array.isArray(projetos) ? projetos : [];
  const projetoAtivo = listaProjetos.find((p) => p.id === projectId);

  function alternar() {
    setAberto((prev) => !prev);
    setCriando(false);
    setErro("");
    setMenuAbertoId(null);
  }

  function escolher(id) {
    selecionarProjeto(id);
    setAberto(false);
    setMenuAbertoId(null);
  }

  function abrirFormulario() {
    setCriando(true);
    setErro("");
  }

  function cancelarCriacao() {
    setCriando(false);
    setNome("");
    setTipo("saas");
    setErro("");
  }

  function alternarMenu(e, id) {
    e.stopPropagation(); // não deixa o clique também selecionar o quadro
    setMenuAbertoId((atual) => (atual === id ? null : id));
  }

  function pedirExclusao(e, projeto) {
    e.stopPropagation();
    setMenuAbertoId(null);
    setParaExcluir(projeto);
  }

  function abrirRenomear(e, projeto) {
    e.stopPropagation();
    setMenuAbertoId(null);
    setParaRenomear(projeto);
  }

  async function confirmarExclusao() {
    const projeto = paraExcluir;
    // Fecha a confirmação JÁ, antes de esperar a exclusão terminar — a
    // reprovisão do quadro padrão (quando é o último) também é assíncrona,
    // e deixar o modal aberto durante essa janela permitia clicar em
    // "Excluir" de novo para o mesmo quadro (que já tinha sido excluído),
    // gerando um "não encontrado" e corrompendo o estado até um F5.
    setParaExcluir(null);
    const sucesso = await excluirProjeto(projeto.id);
    if (sucesso) setAberto(false);
  }

  async function confirmarRenomeio(novoNome) {
    setSalvandoRenome(true);
    const sucesso = await renomearProjeto(paraRenomear.id, novoNome);
    setSalvandoRenome(false);
    // Só fecha em caso de sucesso — se falhar, mantém o modal aberto (com o
    // nome já digitado) para o usuário tentar de novo, sem perder o texto.
    if (sucesso) setParaRenomear(null);
  }

  async function confirmarCriacao() {
    if (!nome.trim()) return;

    setSalvando(true);
    setErro("");
    try {
      await criarProjeto(nome.trim(), tipo);
      setNome("");
      setTipo("saas");
      setCriando(false);
      setAberto(false);
    } catch (err) {
      // A mensagem do backend já é amigável mesmo no caso mais comum
      // (limite do plano gratuito: "Plano gratuito permite apenas 1
      // projeto. Faça upgrade para o plano Pro para criar mais.").
      setErro(err.response?.data?.erro || "Não foi possível criar o quadro. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  // Ainda carregando ou nenhum projeto resolvido: não há seletor para
  // mostrar (ex.: acabamos de excluir o único quadro e o novo padrão ainda
  // está sendo provisionado). A confirmação de exclusão já foi fechada no
  // clique (ver confirmarExclusao), então não há nada para preservar aqui.
  if (carregando || listaProjetos.length === 0) return null;

  return (
    <Wrapper>
      <Trigger
        onClick={alternar}
        $aberto={aberto}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label="Selecionar quadro"
      >
        <TriggerContent>
          {projetoAtivo && getTipoConfig(projetoAtivo.type).icone}
          <span>{projetoAtivo?.name ?? "Selecionar quadro"}</span>
          {projetoAtivo && (
            <TipoBadge>
              {getTipoConfig(projetoAtivo.type).label}
            </TipoBadge>
          )}
        </TriggerContent>
        <FiChevronDown size={16} />
      </Trigger>

      {aberto && (
        <Dropdown role="menu">
          {listaProjetos.map((p) => {
            const configTipo = getTipoConfig(p.type);
            return (
              <ProjetoItem
                key={p.id}
                role="menuitemradio"
                aria-checked={p.id === projectId}
                tabIndex={0}
                $ativo={p.id === projectId}
                onClick={() => escolher(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    escolher(p.id);
                  }
                }}
              >
                <ProjetoNome>
                  {configTipo.icone}
                  <span>{p.name}</span>
                  <TipoBadge>
                    {configTipo.label}
                  </TipoBadge>
                  {p.id === projectId && <FiCheck size={14} />}
                </ProjetoNome>

                <MenuWrapper>
                  <MaisBotao
                    type="button"
                    title="Mais opções"
                    aria-label={`Mais opções para ${p.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuAbertoId === p.id}
                    onClick={(e) => alternarMenu(e, p.id)}
                  >
                    <FiMoreVertical size={14} />
                  </MaisBotao>

                  {menuAbertoId === p.id && (
                    <MenuOpcoes role="menu" onClick={(e) => e.stopPropagation()}>
                      <OpcaoMenu type="button" onClick={(e) => abrirRenomear(e, p)}>
                        <FiEdit2 size={13} />
                        Renomear
                      </OpcaoMenu>
                      {listaProjetos.length > 1 && (
                        <OpcaoMenu type="button" $danger onClick={(e) => pedirExclusao(e, p)}>
                          <FiTrash2 size={13} />
                          Excluir
                        </OpcaoMenu>
                      )}
                    </MenuOpcoes>
                  )}
                </MenuWrapper>
              </ProjetoItem>
            );
          })}

          <Divisor />

          {criando ? (
            <FormBox>
              <NomeInput
                autoFocus
                placeholder="Nome do quadro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmarCriacao();
                  if (e.key === "Escape") cancelarCriacao();
                }}
              />
              <TipoSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="saas">SaaS</option>
                <option value="app">App</option>
                <option value="jogo">Jogo</option>
              </TipoSelect>
              {erro && <ErroTexto role="alert">{erro}</ErroTexto>}
              <Acoes>
                <ConfirmarButton onClick={confirmarCriacao} disabled={salvando || !nome.trim()}>
                  {salvando ? "Criando..." : "Criar"}
                </ConfirmarButton>
                <CancelarButton onClick={cancelarCriacao} title="Cancelar">
                  <FiX size={16} />
                </CancelarButton>
              </Acoes>
            </FormBox>
          ) : (
            <NovoProjetoButton onClick={abrirFormulario}>
              <FiPlus size={14} />
              Novo quadro
            </NovoProjetoButton>
          )}
        </Dropdown>
      )}

      <ConfirmModal
        aberto={!!paraExcluir}
        titulo="Excluir quadro"
        mensagem={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.name}"? Todas as colunas e cards desse quadro serão excluídos permanentemente.`
            : ""
        }
        confirmar={confirmarExclusao}
        cancelar={() => setParaExcluir(null)}
      />

      <ProjectRenameModal
        key={paraRenomear?.id}
        aberto={!!paraRenomear}
        nomeAtual={paraRenomear?.name}
        salvando={salvandoRenome}
        confirmar={confirmarRenomeio}
        cancelar={() => setParaRenomear(null)}
      />
    </Wrapper>
  );
}