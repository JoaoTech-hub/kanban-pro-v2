const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const prisma = require("../config/db");
const env = require("../config/env");
const userRepository = require("../repositories/user.repository");
const organizationRepository = require("../repositories/organization.repository");
const organizationMemberRepository = require("../repositories/organizationMember.repository");
const passwordResetTokenRepository = require("../repositories/passwordResetToken.repository");
const emailVerificationTokenRepository = require("../repositories/emailVerificationToken.repository");
const emailService = require("./email/emailService");
const { ConflictError, UnauthorizedError } = require("../shared/errors/AppError");
const { SEGREDO } = require("../middlewares/auth");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFICACAO_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REENVIO_COOLDOWN_MS = 60 * 1000;

// Instanciado uma vez só (mesmo padrão do prisma em config/db.js). Se
// GOOGLE_CLIENT_ID não estiver configurado, fica null — loginComGoogle()
// falha de forma explícita ao ser chamado, em vez de falhar aqui no boot
// (o Google Login ainda é opcional nesta etapa; nenhum frontend o chama).
const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

function gerarSlug(nome) {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const sufixo = Math.random().toString(36).slice(2, 8);
  return `${base}-${sufixo}`;
}

// Mesma emissão de token usada por registrar(), login() e, agora,
// loginComGoogle() — reaproveita o mecanismo de sessão já existente em vez
// de criar um segundo formato de token só para quem entra pelo Google.
function emitirToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.name, tokenVersion: user.tokenVersion },
    SEGREDO,
    { expiresIn: "7d" }
  );
}

// Mesma transação que registrar() já fazia (criar usuário + workspace +
// vínculo como owner), extraída para ser reaproveitada por loginComGoogle()
// quando é a primeira vez que aquele e-mail aparece no sistema.
async function criarUsuarioComOrganizacao({ nome, email, passwordHash = null, googleId = null, emailVerified }) {
  return prisma.$transaction(
    async (tx) => {
      const user = await userRepository.create(
        { name: nome, email, passwordHash, googleId, emailVerified },
        tx
      );

      const organization = await organizationRepository.create(
        { name: `Workspace de ${nome}`, slug: gerarSlug(nome), plan: "free" },
        tx
      );

      await organizationMemberRepository.create(
        { organizationId: organization.id, userId: user.id, role: "owner" },
        tx
      );

      return { user, organization };
    },
    { timeout: 15000, maxWait: 10000 }
  );
}

async function emitirEValidacaoDeEmail(user) {
  const tokenBruto = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICACAO_TOKEN_TTL_MS);

  await emailVerificationTokenRepository.create({ userId: user.id, tokenBruto, expiresAt });

  const link = `${env.FRONTEND_URL}/verificar-email?token=${tokenBruto}`;

  try {
    await emailService.enviarVerificacaoEmail({ to: user.email, nome: user.name, link });
  } catch (err) {
    console.error("Falha ao enviar e-mail de verificação:", err);
  }
}

async function registrar({ nome, email, senha }) {
  const existe = await userRepository.findByEmail(email);
  if (existe) throw new ConflictError("E-mail já cadastrado");

  const hash = await bcrypt.hash(senha, 10);

  const { user, organization } = await criarUsuarioComOrganizacao({
    nome,
    email,
    passwordHash: hash,
    emailVerified: false,
  });

  await emitirEValidacaoDeEmail(user);

  return {
    token: emitirToken(user),
    nome: user.name,
    organizationId: organization.id,
    emailVerified: user.emailVerified,
  };
}

async function login({ email, senha }) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new UnauthorizedError("E-mail ou senha inválidos");

  if (!user.passwordHash) throw new UnauthorizedError("E-mail ou senha inválidos");

  const valido = await bcrypt.compare(senha, user.passwordHash);
  if (!valido) throw new UnauthorizedError("E-mail ou senha inválidos");

  const membership = await organizationMemberRepository.findFirstByUser(user.id);

  return {
    token: emitirToken(user),
    nome: user.name,
    organizationId: membership?.organizationId ?? null,
    emailVerified: user.emailVerified,
  };
}

async function logout(userId) {
  const resultado = await userRepository.incrementTokenVersion(userId);
  if (resultado.count === 0) throw new UnauthorizedError("N\u00e3o autenticado");
}

// Valida o ID Token emitido pelo Google Identity Services no navegador do
// usuário. verifyIdToken confere, contra as chaves públicas do Google: a
// assinatura, o emissor (iss), a expiração (exp) e a audiência (aud — precisa
// bater com o nosso GOOGLE_CLIENT_ID, senão um token válido emitido para
// OUTRO app poderia ser reaproveitado aqui). Nunca confiamos em nada que o
// client possa ter enviado além deste token opaco.
async function verificarIdTokenGoogle(idToken) {
  if (!googleClient) {
    throw new Error(
      "GOOGLE_CLIENT_ID não configurado — defina a variável de ambiente antes de usar o login com Google."
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new UnauthorizedError("Token do Google inválido ou expirado");
  }

  return ticket.getPayload();
}

async function loginComGoogle({ idToken }) {
  const payload = await verificarIdTokenGoogle(idToken);

  if (!payload?.sub || !payload?.email) {
    throw new UnauthorizedError("Token do Google inválido");
  }

  // email_verified aqui é uma garantia do PRÓPRIO Google (não é algo que o
  // client tenha declarado) — só true depois que o dono confirmou o e-mail
  // junto ao Google. É essa garantia que nos permite pular nosso fluxo local
  // de verificação por link para quem entra por aqui.
  if (!payload.email_verified) {
    throw new UnauthorizedError("O e-mail desta conta Google ainda não foi verificado pelo Google.");
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;

  let user = await userRepository.findByGoogleId(googleId);

  if (!user) {
    const existente = await userRepository.findByEmail(email);

    if (existente) {
      // Já existe uma conta com este e-mail (tipicamente criada por
      // e-mail/senha). Como o e-mail é @unique no schema, nunca poderia
      // existir uma segunda conta com o mesmo e-mail — então, em vez de
      // bloquear ou duplicar, vinculamos o googleId a essa conta. O
      // passwordHash não é tocado: login tradicional continua funcionando
      // normalmente depois disso, dos dois jeitos.
      user = await userRepository.linkGoogleId(existente.id, googleId);
    } else {
      const nome = payload.name?.trim() || email.split("@")[0];
      const criado = await criarUsuarioComOrganizacao({
        nome,
        email,
        passwordHash: null,
        googleId,
        emailVerified: true,
      });
      user = criado.user;
    }
  }

  const membership = await organizationMemberRepository.findFirstByUser(user.id);

  return {
    token: emitirToken(user),
    nome: user.name,
    organizationId: membership?.organizationId ?? null,
    emailVerified: user.emailVerified,
  };
}

async function verificarEmail({ token }) {
  const registro = await emailVerificationTokenRepository.findValidByToken(token);
  if (!registro) throw new UnauthorizedError("Token inválido ou expirado");

  const reivindicado = await emailVerificationTokenRepository.markAsUsedIfValid(registro.id);
  if (!reivindicado) throw new UnauthorizedError("Token inválido ou expirado");

  await userRepository.updateEmailVerified(registro.userId, true);
}

async function reenviarVerificacao(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new UnauthorizedError("Não autenticado");

  if (user.emailVerified) return;

  const maisRecente = await emailVerificationTokenRepository.findMaisRecentePendente(user.id);
  if (maisRecente && Date.now() - maisRecente.createdAt.getTime() < REENVIO_COOLDOWN_MS) {
    throw new ConflictError("Aguarde um pouco antes de solicitar um novo e-mail de confirmação.");
  }

  await emailVerificationTokenRepository.invalidateAllForUser(user.id);
  await emitirEValidacaoDeEmail(user);
}

async function solicitarResetSenha(email) {
  const user = await userRepository.findByEmail(email);
  if (!user) return;
  if (!user.passwordHash) return;

  await passwordResetTokenRepository.invalidateAllForUser(user.id);

  const tokenBruto = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await passwordResetTokenRepository.create({ userId: user.id, tokenBruto, expiresAt });

  const link = `${env.FRONTEND_URL}/redefinir-senha?token=${tokenBruto}`;

  try {
    await emailService.enviarResetSenha({ to: user.email, nome: user.name, link });
  } catch (err) {
    console.error("Falha ao enviar e-mail de redefinição de senha:", err);
  }
}

async function redefinirSenha({ token, novaSenha }) {
  const registro = await passwordResetTokenRepository.findValidByToken(token);
  if (!registro) throw new UnauthorizedError("Token inválido ou expirado");

  const reivindicado = await passwordResetTokenRepository.markAsUsedIfValid(registro.id);
  if (!reivindicado) throw new UnauthorizedError("Token inválido ou expirado");

  const hash = await bcrypt.hash(novaSenha, 10);
  await userRepository.updatePasswordHash(registro.userId, hash);
}

module.exports = {
  registrar,
  login,
  logout,
  loginComGoogle,
  verificarEmail,
  reenviarVerificacao,
  solicitarResetSenha,
  redefinirSenha,
};
