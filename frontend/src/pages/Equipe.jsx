import { useEffect, useState } from "react";
import styled from "styled-components";
import { FiUserPlus, FiTrash2, FiMail, FiClock } from "react-icons/fi";

import PageLayout from "../components/PageLayout";
import Button from "../components/UI/Button";
import Input from "../components/UI/Input";
import Select from "../components/UI/Select";
import ConfirmModal from "../components/ConfirmModal";

import { useAuth } from "../context/AuthContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";
import { useEquipe } from "../context/TeamContext";

const Secao = styled.div`
  background: ${({ theme }) => theme.card};
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  margin-bottom: 24px;
  max-width: 720px;
`;

const CardSaida = styled(Secao)`
  border: 1.5px solid ${({ theme }) => theme.danger}55;
`;

const BotaoPerigo = styled.button`
  border: 1.5px solid ${({ theme }) => theme.danger};
  color: ${({ theme }) => theme.danger};
  background: transparent;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.danger}15;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SecaoTitulo = styled.h2`
  margin: 0 0 18px;
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.text};
`;

const FormConvite = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 8px;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const Linha = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid ${({ theme }) => theme.border};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: ${({ theme }) => theme.text};
    font-size: 14px;
  }

  span {
    color: ${({ theme }) => theme.text};
    opacity: 0.6;
    font-size: 13px;
  }
`;

const Acoes = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const RolePill = styled.span`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 3px 10px;
  border-radius: 20px;
  background: ${({ $role, theme }) => ($role === "owner" ? theme.primary : theme.border)};
  color: ${({ $role, theme }) => ($role === "owner" ? "white" : theme.text)};
`;

const VazioMsg = styled.p`
  color: ${({ theme }) => theme.text};
  opacity: 0.55;
  font-size: 14px;
`;

// Só o owner pode conceder/gerenciar o papel "admin" — mesma regra do
// backend (shared/authorization.js), espelhada aqui só pra UI não oferecer
// uma ação que o backend vai recusar de qualquer forma.
function podeGerenciar(meuRole, roleAlvo) {
  if (roleAlvo === "owner") return false;
  if (roleAlvo === "admin" && meuRole !== "owner") return false;
  return meuRole === "owner" || meuRole === "admin";
}

export default function Equipe() {
  const { organizationId, emailVerified, trocarOrganizacao, logout } = useAuth();
  const { organizacoes, sair, atualizarNome } = useOrganizacoes();
  const {
    membros,
    convites,
    convidar,
    revogarConvite,
    alterarRole,
    removerMembro,
    transferirOwnership,
    carregar,
    carregouAoMenosUmaVez,
  } = useEquipe();

  const [email, setEmail] = useState("");
  const [roleConvite, setRoleConvite] = useState("member");
  const [enviando, setEnviando] = useState(false);
  const [alvoTransferencia, setAlvoTransferencia] = useState("");
  const [confirmandoTransferencia, setConfirmandoTransferencia] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  // Rastreia o nome anterior pra detectar troca de organização durante a
  // renderização (padrão recomendado pelo React pra "ajustar estado quando
  // uma prop muda"), evitando o anti-padrão de chamar setState dentro de um
  // useEffect só pra sincronizar.
  const [nomeOrganizacaoAnterior, setNomeOrganizacaoAnterior] = useState(undefined);

  useEffect(() => {
    if (!organizationId || !emailVerified || !carregouAoMenosUmaVez) return undefined;
    let ativo = true;
    let atualizacaoEmAndamento = false;

    async function atualizarEquipe() {
      if (!ativo || atualizacaoEmAndamento || document.visibilityState !== "visible") return;
      atualizacaoEmAndamento = true;
      try {
        await carregar();
      } finally {
        atualizacaoEmAndamento = false;
      }
    }

    function aoVoltarParaAba() {
      if (document.visibilityState === "visible") atualizarEquipe();
    }

    const intervalo = window.setInterval(atualizarEquipe, 30_000);
    document.addEventListener("visibilitychange", aoVoltarParaAba);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [organizationId, emailVerified, carregouAoMenosUmaVez, carregar]);

  const minhaOrganizacao = organizacoes.find((o) => o.id === organizationId);

  // Mantém o campo de edição sincronizado se a organização ativa mudar (ex.:
  // usuário trocou de organização no seletor) ou se o nome mudar em outra aba.
  if (minhaOrganizacao?.name !== nomeOrganizacaoAnterior) {
    setNomeOrganizacaoAnterior(minhaOrganizacao?.name);
    setNovoNome(minhaOrganizacao?.name || "");
  }

  const meuRole = minhaOrganizacao?.role;
  const souOwner = meuRole === "owner";
  const souGerencial = meuRole === "owner" || meuRole === "admin";

  // Espelha a mesma regra do backend (garantirPodeSair) só pra UX — o
  // backend continua sendo a fonte de verdade, então mesmo que esse cálculo
  // divirja por algum motivo, a ação real segue protegida no servidor.
  // Único bloqueio: ser owner (precisa transferir antes). Não há mais
  // restrição de "última organização" — admin/member sempre podem sair,
  // mesmo que seja a única organização deles (ex.: ex-owner que acabou de
  // transferir a propriedade e só pertence a essa organização).
  const podeSair = !souOwner;

  function motivoBloqueioSaida() {
    if (souOwner) return "Você é o owner desta organização — transfira a propriedade antes de sair.";
    return "";
  }

  async function confirmarSaida() {
    setSaindo(true);
    const resultado = await sair(organizationId);
    setSaindo(false);
    setConfirmandoSaida(false);

    if (resultado.ok) {
      const proxima = resultado.organizacoes[0];
      if (proxima) {
        trocarOrganizacao(proxima.id);
      } else {
        // Não deveria acontecer (o backend bloqueia sair da última
        // organização), mas se acontecer, desloga em vez de deixar a UI
        // num estado sem organização nenhuma pra mostrar.
        logout();
      }
    }
  }

  async function salvarNome(e) {
    e.preventDefault();
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo || nomeLimpo === minhaOrganizacao?.name) return;
    setSalvandoNome(true);
    await atualizarNome(organizationId, nomeLimpo);
    setSalvandoNome(false);
  }

  async function enviarConvite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setEnviando(true);
    const ok = await convidar(email.trim(), roleConvite);
    setEnviando(false);
    if (ok) {
      setEmail("");
      setRoleConvite("member");
    }
  }

  async function confirmarTransferencia() {
    if (!alvoTransferencia) return;
    setTransferindo(true);
    const ok = await transferirOwnership(alvoTransferencia);
    setTransferindo(false);
    setConfirmandoTransferencia(false);
    if (ok) setAlvoTransferencia("");
  }

  // Ponto único de entrada do Select por membro (Member/Admin/Owner).
  // "Owner" selecionado NÃO chama alterarRole (o backend rejeitaria mesmo:
  // alterarRoleSchema só aceita admin/member) — em vez disso, dispara
  // exatamente o mesmo fluxo de transferência de ownership já existente
  // (mesma confirmação, mesmo service, mesmos locks de concorrência da 6.9).
  // Promover a Owner = Transferir Ownership; não é um segundo caminho.
  function handleAlterarRoleSelect(userId, novoRole) {
    if (novoRole === "owner") {
      setAlvoTransferencia(userId);
      setConfirmandoTransferencia(true);
      return;
    }
    alterarRole(userId, novoRole);
  }

  return (
    <PageLayout titulo="Equipe" subtitulo="Gerencie quem tem acesso a esta organização">
      <Secao>
        <SecaoTitulo>Nome da organização</SecaoTitulo>
        {souOwner ? (
          <FormConvite onSubmit={salvarNome}>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              maxLength={120}
              required
              style={{ flex: 2 }}
            />
            <Button
              type="submit"
              disabled={salvandoNome || !novoNome.trim() || novoNome.trim() === minhaOrganizacao?.name}
            >
              {salvandoNome ? "Salvando..." : "Salvar"}
            </Button>
          </FormConvite>
        ) : (
          <VazioMsg style={{ marginBottom: 0 }}>
            {minhaOrganizacao?.name} · somente o owner pode alterar
          </VazioMsg>
        )}
      </Secao>

      {souGerencial && (
        <Secao>
          <SecaoTitulo>Convidar novo membro</SecaoTitulo>
          <FormConvite onSubmit={enviarConvite}>
            <Input
              type="email"
              placeholder="E-mail da pessoa a convidar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ flex: 2 }}
            />
            <Select
              value={roleConvite}
              onChange={(e) => setRoleConvite(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="member">Membro</option>
              {/* Só o owner pode convidar como admin — mesma regra do backend. */}
              {souOwner && <option value="admin">Admin</option>}
            </Select>
            <Button type="submit" disabled={enviando}>
              <FiUserPlus />
              {enviando ? "Enviando..." : "Convidar"}
            </Button>
          </FormConvite>
        </Secao>
      )}

      <Secao>
        <SecaoTitulo>Membros ({membros.length})</SecaoTitulo>
        {carregouAoMenosUmaVez && membros.length === 0 && <VazioMsg>Nenhum membro ainda.</VazioMsg>}
        {membros.map((m) => (
          <Linha key={m.userId}>
            <Info>
              <strong>{m.nome}</strong>
              <span>{m.email}</span>
            </Info>
            <Acoes>
              {podeGerenciar(meuRole, m.role) ? (
                <>
                  <Select
                    value={m.role}
                    onChange={(e) => handleAlterarRoleSelect(m.userId, e.target.value)}
                    style={{ width: 110 }}
                  >
                    <option value="member">Membro</option>
                    {souOwner && <option value="admin">Admin</option>}
                    {/* Selecionar "Owner" dispara o mesmo fluxo de transferência
                        de ownership (com confirmação) — ver handleAlterarRoleSelect. */}
                    {souOwner && <option value="owner">Owner</option>}
                  </Select>
                  <Button danger secondary onClick={() => removerMembro(m.userId)}>
                    <FiTrash2 />
                  </Button>
                </>
              ) : (
                <RolePill $role={m.role}>{m.role}</RolePill>
              )}
            </Acoes>
          </Linha>
        ))}
      </Secao>

      {souGerencial && (
        <Secao>
          <SecaoTitulo>Convites pendentes ({convites.length})</SecaoTitulo>
          {carregouAoMenosUmaVez && convites.length === 0 && (
            <VazioMsg>Nenhum convite pendente.</VazioMsg>
          )}
          {convites.map((c) => (
            <Linha key={c.id}>
              <Info>
                <strong>
                  <FiMail style={{ verticalAlign: "middle", marginRight: 6 }} />
                  {c.email}
                </strong>
                <span>
                  <FiClock style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Convidado por {c.invitedBy?.name || "—"} · papel: {c.role}
                </span>
              </Info>
              <Acoes>
                <Button danger secondary onClick={() => revogarConvite(c.id)}>
                  Revogar
                </Button>
              </Acoes>
            </Linha>
          ))}
        </Secao>
      )}
      {/* A ação de transferir ownership agora vive direto no Select de cada
          membro acima (opção "Owner") — ver handleAlterarRoleSelect. Isso
          elimina o segundo ponto de entrada que existia aqui antes, evitando
          dois jeitos diferentes de disparar a mesma operação. */}
      <ConfirmModal
        aberto={confirmandoTransferencia}
        titulo="Transferir propriedade da organização?"
        mensagem={`Você deixará de ser owner imediatamente e vai virar admin. "${
          membros.find((m) => m.userId === alvoTransferencia)?.nome || "Este membro"
        }" assume a organização. Essa ação não pode ser desfeita por você sozinho — só o novo owner poderá transferir de volta.`}
        textoConfirmar={transferindo ? "Transferindo..." : "Transferir"}
        confirmar={confirmarTransferencia}
        cancelar={() => {
          setConfirmandoTransferencia(false);
          setAlvoTransferencia("");
        }}
      />

      {/* Separado das ações administrativas acima — esta é uma ação sobre o
          PRÓPRIO vínculo do usuário logado, não sobre gerenciar a equipe. */}
      <CardSaida>
        <SecaoTitulo>Sua participação na organização</SecaoTitulo>
        <Linha style={{ paddingTop: 0 }}>
          <Info>
            <strong>Sair da organização</strong>
            <span>
              {podeSair
                ? "Remove seu acesso a esta organização — você continua com suas outras contas."
                : motivoBloqueioSaida()}
            </span>
          </Info>
          <BotaoPerigo disabled={!podeSair} onClick={() => setConfirmandoSaida(true)}>
            Sair
          </BotaoPerigo>
        </Linha>
      </CardSaida>

      <ConfirmModal
        aberto={confirmandoSaida}
        titulo="Sair da organização?"
        mensagem={`Você vai perder acesso a "${minhaOrganizacao?.name}" imediatamente. Essa ação não pode ser desfeita — você precisaria de um novo convite para voltar.`}
        textoConfirmar={saindo ? "Saindo..." : "Sair"}
        confirmar={confirmarSaida}
        cancelar={() => setConfirmandoSaida(false)}
      />
    </PageLayout>
  );
}
