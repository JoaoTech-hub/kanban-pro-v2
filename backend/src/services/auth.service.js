const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../config/db");
const env = require("../config/env");
const userRepository = require("../repositories/user.repository");
const organizationRepository = require("../repositories/organization.repository");
const organizationMemberRepository = require("../repositories/organizationMember.repository");
const passwordResetTokenRepository = require("../repositories/passwordResetToken.repository");
const emailService = require("./email/emailService");
const { ConflictError, UnauthorizedError } = require("../shared/errors/AppError");
const { SEGREDO } = require("../middlewares/auth");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

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

async function registrar({ nome, email, senha }) {
  const existe = await userRepository.findByEmail(email);
  if (existe) throw new ConflictError("E-mail já cadastrado");

  const hash = await bcrypt.hash(senha, 10);

  const { user, organization } = await prisma.$transaction(
    async (tx) => {
      const user = await userRepository.create({ name: nome, email, passwordHash: hash }, tx);

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
    // O padrão do Prisma (5000ms) pode não ser suficiente com um Postgres
    // serverless (ex.: Neon), que às vezes precisa "acordar" a instância
    // antes da primeira query — isso já causou falha real em teste
    // (transação de ~7.9s estourando o limite de 5s). 15s dá margem
    // confortável sem mascarar uma lentidão anormal de verdade.
    // maxWait (tempo pra CONSEGUIR um slot e começar a transação, distinto
    // de timeout, que só conta depois de já ter começado) também fica no
    // default do Prisma (2000ms) se não for informado — curto demais pro
    // mesmo cenário de cold start/serverless, e foi a causa raiz confirmada
    // de um P2028 ("Unable to start a transaction in the given time").
    { timeout: 15000, maxWait: 10000 }
  );

  const token = jwt.sign(
    { id: user.id, nome: user.name, tokenVersion: user.tokenVersion },
    SEGREDO,
    { expiresIn: "7d" }
  );

  return { token, nome: user.name, organizationId: organization.id };
}

async function login({ email, senha }) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new UnauthorizedError("E-mail ou senha inválidos");

  const valido = await bcrypt.compare(senha, user.passwordHash);
  if (!valido) throw new UnauthorizedError("E-mail ou senha inválidos");

  const membership = await organizationMemberRepository.findFirstByUser(user.id);

  const token = jwt.sign(
    { id: user.id, nome: user.name, tokenVersion: user.tokenVersion },
    SEGREDO,
    { expiresIn: "7d" }
  );

  return { token, nome: user.name, organizationId: membership?.organizationId ?? null };
}

async function solicitarResetSenha(email) {
  const user = await userRepository.findByEmail(email);

  // Mesma resposta (silêncio, sem erro) independente do e-mail existir —
  // evita que alguém use esse endpoint pra descobrir quais e-mails têm conta.
  if (!user) return;

  await passwordResetTokenRepository.invalidateAllForUser(user.id);

  const tokenBruto = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await passwordResetTokenRepository.create({ userId: user.id, tokenBruto, expiresAt });

  const link = `${env.FRONTEND_URL}/redefinir-senha?token=${tokenBruto}`;

  // O envio de e-mail nunca pode propagar até o cliente: se propagasse, o
  // errorHandler devolveria err.message na resposta (fora de produção) e
  // quebraria a garantia de resposta genérica acima — além de já ter
  // vazado, na prática, detalhes internos do provedor (ex.: endereço de
  // e-mail do remetente configurado) para um visitante não autenticado.
  // A falha é logada para observabilidade, mas o fluxo do usuário segue
  // normalmente: o token já foi criado e continua válido para uso caso o
  // e-mail acabe chegando por outro meio, ou para nova tentativa.
  try {
    await emailService.enviarResetSenha({ to: user.email, nome: user.name, link });
  } catch (err) {
    console.error("Falha ao enviar e-mail de redefinição de senha:", err);
  }
}

async function redefinirSenha({ token, novaSenha }) {
  const registro = await passwordResetTokenRepository.findValidByToken(token);
  if (!registro) throw new UnauthorizedError("Token inválido ou expirado");

  // Reivindica o token atomicamente ANTES de mexer na senha. Se duas
  // requisições com o mesmo token chegarem quase ao mesmo tempo (ex.: duplo
  // clique), só uma consegue "ganhar" aqui — a outra recebe false e é
  // barrada, mesmo que as duas tenham visto o token como válido no
  // findValidByToken acima.
  const reivindicado = await passwordResetTokenRepository.markAsUsedIfValid(registro.id);
  if (!reivindicado) throw new UnauthorizedError("Token inválido ou expirado");

  const hash = await bcrypt.hash(novaSenha, 10);

  // updatePasswordHash já incrementa tokenVersion (item 1.4) — trocar a
  // senha por esse fluxo também revoga qualquer sessão antiga automaticamente.
  await userRepository.updatePasswordHash(registro.userId, hash);
}

module.exports = { registrar, login, solicitarResetSenha, redefinirSenha };