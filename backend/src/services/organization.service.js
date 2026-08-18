const memberRepository = require("../repositories/organizationMember.repository");
const organizationRepository = require("../repositories/organization.repository");
const prisma = require("../config/db");
const { NotFoundError, ConflictError } = require("../shared/errors/AppError");
const {
  garantirPodeAtribuirRole,
  garantirPodeGerenciarMembro,
  garantirPodeSair,
  garantirPodeTransferirOwnership,
  garantirEhOwner,
} = require("../shared/authorization");

// Todas as organizações do usuário logado — usado pelo seletor de
// organização no frontend. Cada item já vem com o `role` do usuário
// nela, pra a UI decidir o que mostrar sem precisar de outra chamada.
async function listarMinhas(usuarioId) {
  const vinculos = await memberRepository.findAllByUser(usuarioId);
  return vinculos.map((vinculo) => ({
    id: vinculo.organization.id,
    name: vinculo.organization.name,
    slug: vinculo.organization.slug,
    plan: vinculo.organization.plan,
    role: vinculo.role,
    joinedAt: vinculo.joinedAt,
  }));
}

// Leitura: qualquer membro pode ver a lista de colegas, sem checagem de role.
async function listarMembros(organizationId) {
  const membros = await memberRepository.findManyByOrganization(organizationId);
  return membros.map((m) => ({
    userId: m.user.id,
    nome: m.user.name,
    email: m.user.email,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

async function alterarRole(organizationId, organizationRole, targetUserId, novoRole) {
  const alvo = await memberRepository.findByUserAndOrg(targetUserId, organizationId);
  if (!alvo) throw new NotFoundError("Membro não encontrado nesta organização");

  // Duas checagens diferentes e complementares:
  // - garantirPodeAtribuirRole: quem está fazendo a ação pode CONCEDER o `novoRole`?
  // - garantirPodeGerenciarMembro: quem está fazendo a ação pode mexer no papel ATUAL do alvo?
  // Ex.: um admin não pode promover ninguém a admin (primeira checagem) NEM
  // rebaixar outro admin já existente (segunda checagem) — só o owner pode ambos.
  garantirPodeAtribuirRole(organizationRole, novoRole);
  garantirPodeGerenciarMembro(organizationRole, alvo.role);

  // Escrita condicional (updateRoleSeAtual, não updateRole): só efetiva se a
  // role do alvo, no momento exato desta escrita, ainda for a mesma que foi
  // lida e autorizada acima. Fecha uma corrida real: sem isso, uma
  // requisição concorrente poderia promover o alvo a admin entre a leitura
  // e esta escrita, e esta chamada (autorizada com base num "member" que já
  // não existe mais) ainda assim seria aceita — furando a regra de que só o
  // owner mexe em admin.
  const atualizado = await memberRepository.updateRoleSeAtual(
    organizationId,
    targetUserId,
    alvo.role,
    novoRole
  );
  if (!atualizado) {
    throw new ConflictError(
      "O papel deste membro mudou nos últimos instantes — tente novamente."
    );
  }
}

async function removerMembro(organizationId, organizationRole, targetUserId, usuarioIdLogado) {
  if (targetUserId === usuarioIdLogado) {
    throw new ConflictError(
      "Você não pode remover a si mesmo por aqui. Peça a outro owner/admin, se necessário."
    );
  }

  const alvo = await memberRepository.findByUserAndOrg(targetUserId, organizationId);
  if (!alvo) throw new NotFoundError("Membro não encontrado nesta organização");

  garantirPodeGerenciarMembro(organizationRole, alvo.role);

  // Mesmo raciocínio de alterarRole, agora pra remoção: removeSeRole só
  // efetiva se a role do alvo ainda for a mesma autorizada acima.
  const removido = await memberRepository.removeSeRole(organizationId, targetUserId, alvo.role);
  if (!removido) {
    throw new ConflictError(
      "O papel deste membro mudou nos últimos instantes — tente novamente."
    );
  }
}

// Sair voluntariamente (self-service) — diferente de removerMembro, que é
// uma ação de terceiro (owner/admin removendo outra pessoa). Aqui quem sai é
// o próprio usuário autenticado, sobre o próprio vínculo.
async function sair(organizationId, organizationRole, usuarioId) {
  garantirPodeSair(organizationRole);

  await memberRepository.remove(organizationId, usuarioId);

  // Retorna a lista já atualizada de organizações do usuário — o frontend
  // usa isso pra trocar direto pra outra organização, sem uma segunda chamada.
  return listarMinhas(usuarioId);
}

// Owner transfere a propriedade da organização diretamente para qualquer
// membro atual (admin ou member) — decisão explícita: não exige que o alvo
// já seja admin. O owner já tem autoridade máxima sobre atribuição de papéis
// (mesma premissa de garantirPodeAtribuirRole na 6.8); exigir uma promoção
// intermediária seria uma cerimônia sem ganho real de segurança.
async function transferirOwnership(organizationId, organizationRole, usuarioIdAtual, novoOwnerUserId) {
  garantirPodeTransferirOwnership(organizationRole);

  if (novoOwnerUserId === usuarioIdAtual) {
    throw new ConflictError("Você já é o owner desta organização");
  }

  const alvo = await memberRepository.findByUserAndOrg(novoOwnerUserId, organizationId);
  if (!alvo) throw new NotFoundError("Este usuário não é membro desta organização");

  await prisma.$transaction(
    async (tx) => {
      // As duas escritas são condicionais (updateRoleSeAtual, não updateRole):
      // só efetivam se a role de cada lado ainda for exatamente a esperada no
      // momento da escrita. Fecha o cenário de o alvo ter saído da organização
      // (ou tido a role alterada por outra ação) entre a checagem acima e esta
      // transação — em vez de completar parcialmente e deixar a organização
      // sem owner, a operação inteira falha com um erro claro.
      const alvoAtualizado = await memberRepository.updateRoleSeAtual(
        organizationId,
        novoOwnerUserId,
        alvo.role,
        "owner",
        tx
      );
      if (!alvoAtualizado) {
        throw new ConflictError(
          "O papel deste membro mudou nos últimos instantes — tente novamente."
        );
      }

      const ownerAtualizado = await memberRepository.updateRoleSeAtual(
        organizationId,
        usuarioIdAtual,
        "owner",
        "admin",
        tx
      );
      if (!ownerAtualizado) {
        throw new ConflictError(
          "Você não é mais o owner desta organização — a página será atualizada."
        );
      }
    },
    { maxWait: 10000 }
  );
}

// Renomear a organização — só o owner. Reaproveita organizationRepository
// (mesmo idioma de updatePlan, já existente); não há concorrência relevante
// a proteger aqui (diferente de role, name não tem invariante multi-linha).
async function atualizarNome(organizationId, organizationRole, novoNome) {
  garantirEhOwner(organizationRole);
  return organizationRepository.updateName(organizationId, novoNome);
}

module.exports = {
  listarMinhas,
  listarMembros,
  alterarRole,
  removerMembro,
  sair,
  transferirOwnership,
  atualizarNome,
};