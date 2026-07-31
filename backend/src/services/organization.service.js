const memberRepository = require("../repositories/organizationMember.repository");
const { NotFoundError, ConflictError } = require("../shared/errors/AppError");
const { garantirPodeAtribuirRole, garantirPodeGerenciarMembro } = require("../shared/authorization");

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

  await memberRepository.updateRole(organizationId, targetUserId, novoRole);
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

  await memberRepository.remove(organizationId, targetUserId);
}

module.exports = { listarMinhas, listarMembros, alterarRole, removerMembro };