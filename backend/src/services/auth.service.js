const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
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

  const { user, organization } = await prisma.$transaction(
    async (tx) => {
      const user = await userRepository.create(
        { name: nome, email, passwordHash: hash, emailVerified: false },
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

  await emitirEValidacaoDeEmail(user);

  const token = jwt.sign(
    { id: user.id, nome: user.name, tokenVersion: user.tokenVersion },
    SEGREDO,
    { expiresIn: "7d" }
  );

  return {
    token,
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

  const token = jwt.sign(
    { id: user.id, nome: user.name, tokenVersion: user.tokenVersion },
    SEGREDO,
    { expiresIn: "7d" }
  );

  return {
    token,
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
  verificarEmail,
  reenviarVerificacao,
  solicitarResetSenha,
  redefinirSenha,
};