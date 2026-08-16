const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const env = require("../config/env");
const inviteRepository = require("../repositories/organizationInvite.repository");
const memberRepository = require("../repositories/organizationMember.repository");
const userRepository = require("../repositories/user.repository");
const organizationRepository = require("../repositories/organization.repository");
const emailService = require("./email/emailService");
const { garantirPodeAtribuirRole, garantirPapelGerencial } = require("../shared/authorization");
const {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  PlanLimitError,
} = require("../shared/errors/AppError");
const { SEGREDO } = require("../middlewares/auth");
const { limiteMembros } = require("../shared/planLimits");

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

async function criar({ organization, organizationRole, invitedById, email, role }) {
  garantirPodeAtribuirRole(organizationRole, role);

  // Já é membro? Não faz sentido convidar de novo.
  const usuarioExistente = await userRepository.findByEmail(email);
  if (usuarioExistente) {
    const jaMembro = await memberRepository.findByUserAndOrg(usuarioExistente.id, organization.id);
    if (jaMembro) throw new ConflictError("Este e-mail já pertence à organização");
  }

  return prisma.$transaction(
    async (tx) => {
      const limite = limiteMembros(organization.plan);

      if (Number.isFinite(limite)) {
        // Mesmo padrão de lockForUpdate já usado no limite de projetos:
        // trava a organização antes de contar, pra duas criações de
        // convite concorrentes não lerem a mesma contagem desatualizada.
        await organizationRepository.lockForUpdate(organization.id, tx);

        const total = await memberRepository.countByOrganization(organization.id, tx);
        if (total >= limite) {
          throw new PlanLimitError(
            `Você atingiu o limite de ${limite} membros do plano atual. Faça upgrade para o plano Pro para convidar mais pessoas.`
          );
        }
      }

      // Evita ter dois convites pendentes pro mesmo e-mail ao mesmo tempo.
      await inviteRepository.invalidatePendingForEmail(organization.id, email, tx);

      const tokenBruto = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

      const invite = await inviteRepository.create(
        { organizationId: organization.id, email, role, tokenBruto, invitedById, expiresAt },
        tx
      );

      return { invite, tokenBruto };
    },
    { timeout: 15000, maxWait: 10000 }
  );
}

async function enviarEmailConvite({ invite, tokenBruto, organization, nomeConvidante }) {
  const link = `${env.FRONTEND_URL}/convites/${tokenBruto}`;

  // Mesma cautela do reset de senha: falha no envio nunca pode propagar
  // pro cliente — o convite já foi criado e continua válido mesmo que o
  // e-mail não chegue (dá pra reenviar criando um novo convite depois).
  try {
    await emailService.enviarConvite({
      to: invite.email,
      nomeOrganizacao: organization.name,
      nomeConvidante,
      link,
    });
  } catch (err) {
    console.error("Falha ao enviar e-mail de convite:", err);
  }
}

function listarPendentes(organizationId) {
  return inviteRepository.findPendingByOrganization(organizationId);
}

async function revogar(inviteId, organizationId, organizationRole) {
  garantirPapelGerencial(organizationRole);

  const revogado = await inviteRepository.revoke(inviteId, organizationId);
  if (!revogado) throw new NotFoundError("Convite não encontrado ou já processado");
}

// Dados públicos do convite — a tela de aceite usa `contaExistente` pra
// decidir se mostra formulário de login ou de cadastro. Nunca expõe mais
// do que isso pra um visitante não autenticado.
async function buscarPorToken(tokenBruto) {
  const invite = await inviteRepository.findValidByToken(tokenBruto);
  if (!invite) throw new UnauthorizedError("Convite inválido, expirado ou já utilizado");

  const usuarioExistente = await userRepository.findByEmail(invite.email);

  return {
    email: invite.email,
    role: invite.role,
    nomeOrganizacao: invite.organization.name,
    nomeConvidante: invite.invitedBy.name,
    contaExistente: !!usuarioExistente,
  };
}

// Fluxo A: quem aceita AINDA NÃO tem conta — cadastra e vincula na mesma transação.
async function aceitarContaNova(tokenBruto, { nome, senha }) {
  const invite = await inviteRepository.findValidByToken(tokenBruto);
  if (!invite) throw new UnauthorizedError("Convite inválido, expirado ou já utilizado");

  const usuarioExistente = await userRepository.findByEmail(invite.email);
  if (usuarioExistente) {
    throw new ConflictError("Este e-mail já tem uma conta — faça login para aceitar o convite");
  }

  const hash = await bcrypt.hash(senha, 10);

  const { user } = await prisma.$transaction(
    async (tx) => {
      const limite = limiteMembros(invite.organization.plan);

      if (Number.isFinite(limite)) {
        // Mesmo padrão de lock usado em `criar()` — mas agora do lado de
        // quem ACEITA, não de quem convida. `criar()` sozinho não impede
        // que uma organização ultrapasse o limite do plano: nada contava
        // convites pendentes, só membros atuais, então era possível
        // enviar convites além do limite e o problema só aparecer (ou
        // não) na hora de vários serem aceitos ao mesmo tempo. Travar a
        // organização aqui fecha a mesma invariante no ponto em que ela
        // realmente é violada — quando o membro é de fato adicionado.
        await organizationRepository.lockForUpdate(invite.organizationId, tx);

        const total = await memberRepository.countByOrganization(invite.organizationId, tx);
        if (total >= limite) {
          throw new PlanLimitError(
            `Esta organização já atingiu o limite de ${limite} membros do plano atual. Peça para um administrador fazer upgrade para o plano Pro antes de aceitar este convite.`
          );
        }
      }

      // Reivindica o convite ANTES de criar a conta — mesmo padrão atômico
      // do reset de senha, fecha a janela de corrida de duplo aceite simultâneo.
      const reivindicado = await inviteRepository.markAsAcceptedIfValid(invite.id, tx);
      if (!reivindicado) throw new UnauthorizedError("Convite inválido, expirado ou já utilizado");

      const user = await userRepository.create(
        { name: nome, email: invite.email, passwordHash: hash },
        tx
      );
      await memberRepository.create(
        { organizationId: invite.organizationId, userId: user.id, role: invite.role },
        tx
      );

      return { user };
    },
    { timeout: 15000, maxWait: 10000 }
  );

  const token = jwt.sign(
    { id: user.id, nome: user.name, tokenVersion: user.tokenVersion },
    SEGREDO,
    { expiresIn: "7d" }
  );

  return { token, nome: user.name, organizationId: invite.organizationId };
}

// Fluxo B: quem aceita JÁ TEM conta — precisa estar autenticado. O e-mail da
// conta logada precisa bater com o e-mail do convite (case-insensitive, já
// que todo e-mail no sistema é normalizado em minúsculas no cadastro/login),
// senão alguém poderia repassar o link do convite pra outra pessoa aceitar
// logada com uma conta diferente da que foi de fato convidada.
async function aceitarContaExistente(tokenBruto, usuarioId) {
  const invite = await inviteRepository.findValidByToken(tokenBruto);
  if (!invite) throw new UnauthorizedError("Convite inválido, expirado ou já utilizado");

  const usuario = await userRepository.findById(usuarioId);
  if (!usuario || usuario.email !== invite.email) {
    throw new ForbiddenError("Este convite não pertence à conta com a qual você está logado");
  }

  const jaMembro = await memberRepository.findByUserAndOrg(usuarioId, invite.organizationId);
  if (jaMembro) throw new ConflictError("Você já pertence a esta organização");

  await prisma.$transaction(
    async (tx) => {
      const limite = limiteMembros(invite.organization.plan);

      if (Number.isFinite(limite)) {
        // Mesma checagem e mesmo motivo de aceitarContaNova — ver comentário lá.
        await organizationRepository.lockForUpdate(invite.organizationId, tx);

        const total = await memberRepository.countByOrganization(invite.organizationId, tx);
        if (total >= limite) {
          throw new PlanLimitError(
            `Esta organização já atingiu o limite de ${limite} membros do plano atual. Peça para um administrador fazer upgrade para o plano Pro antes de aceitar este convite.`
          );
        }
      }

      const reivindicado = await inviteRepository.markAsAcceptedIfValid(invite.id, tx);
      if (!reivindicado) throw new UnauthorizedError("Convite inválido, expirado ou já utilizado");

      await memberRepository.create(
        { organizationId: invite.organizationId, userId: usuarioId, role: invite.role },
        tx
      );
    },
    { maxWait: 10000 }
  );

  return { organizationId: invite.organizationId };
}

module.exports = {
  criar,
  enviarEmailConvite,
  listarPendentes,
  revogar,
  buscarPorToken,
  aceitarContaNova,
  aceitarContaExistente,
};