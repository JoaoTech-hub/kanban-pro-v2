// Mesmo padrão de reset-senha.test.js: simula o serviço de e-mail inteiro
// (sem depender de internet/Resend real), e usa o "link" capturado pra
// extrair o token e continuar o fluxo nos testes.
jest.mock("../src/services/email/emailService", () => ({
  enviarVerificacaoEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../src/app");
const prisma = require("../src/config/db");
const emailService = require("../src/services/email/emailService");
const userRepository = require("../src/repositories/user.repository");
const organizationRepository = require("../src/repositories/organization.repository");
const organizationMemberRepository = require("../src/repositories/organizationMember.repository");
const { registrarUsuario, registrarUsuarioNaoVerificado } = require("./helpers/authHelpers");

function extrairTokenDoLink(link) {
  const url = new URL(link);
  return url.searchParams.get("token");
}

async function ultimoTokenPendente(userId) {
  return prisma.emailVerificationToken.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

// Empurra o `createdAt` do token pendente mais recente pra fora da janela
// de cooldown (60s), direto no banco — determinístico e instantâneo, sem
// precisar de setTimeout real nem mexer no relógio do processo (o
// cooldown compara contra um `createdAt` que o Postgres gerou via
// @default(now()), então fake timers do Jest não afetariam esse valor de
// qualquer forma).
async function empurrarCooldownParaTras(userId) {
  const registro = await ultimoTokenPendente(userId);
  await prisma.emailVerificationToken.update({
    where: { id: registro.id },
    data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
  });
}

describe("Verificação de e-mail (Fase 8.1)", () => {
  beforeEach(() => {
    emailService.enviarVerificacaoEmail.mockClear();
  });

  test("cadastro cria a conta com emailVerified: false", async () => {
    const email = `naoverificado_${Date.now()}@teste.com`;

    const res = await request(app)
      .post("/registro")
      .send({ nome: "Fulano", email, senha: "senha123" });

    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(false);
    // JWT continua sendo emitido normalmente no cadastro (decisão da Fase
    // 8.1) — a conta não verificada perde acesso a dados, não à sessão.
    expect(res.body.token).toBeDefined();
    expect(res.body.organizationId).toBeDefined();
  });

  test("cadastro dispara o e-mail de confirmação com o link correto", async () => {
    const email = `confirmaenvio_${Date.now()}@teste.com`;

    await request(app).post("/registro").send({ nome: "Fulano", email, senha: "senha123" });

    expect(emailService.enviarVerificacaoEmail).toHaveBeenCalledTimes(1);
    const chamada = emailService.enviarVerificacaoEmail.mock.calls[0][0];
    expect(chamada.to).toBe(email.toLowerCase());
    expect(chamada.link).toContain("/verificar-email?token=");
  });

  test("conta não verificada não acessa rotas de dado da organização (403 com código EMAIL_NAO_VERIFICADO)", async () => {
    const usuario = await registrarUsuarioNaoVerificado("semAcesso");

    const res = await request(app)
      .get(`/organizations/${usuario.organizationId}/projects`)
      .set("Authorization", `Bearer ${usuario.token}`);

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe("EMAIL_NAO_VERIFICADO");
  });

  test("conta não verificada AINDA consegue ver o próprio perfil e listar suas organizações (não fica totalmente travada)", async () => {
    const usuario = await registrarUsuarioNaoVerificado("perfilOk");

    const perfil = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(perfil.status).toBe(200);

    const organizacoes = await request(app)
      .get("/organizations")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(organizacoes.status).toBe(200);
  });

  test("conta não verificada NÃO consegue editar o próprio perfil (PATCH /perfil bloqueado)", async () => {
    const usuario = await registrarUsuarioNaoVerificado("perfilPatchBloqueado");

    const res = await request(app)
      .patch("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ nome: "Novo Nome" });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe("EMAIL_NAO_VERIFICADO");
  });

  test("conta não verificada NÃO consegue trocar a própria senha (PATCH /perfil/senha bloqueado)", async () => {
    const usuario = await registrarUsuarioNaoVerificado("perfilSenhaBloqueada");

    const res = await request(app)
      .patch("/perfil/senha")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ senhaAtual: "senha123", novaSenha: "novaSenha456" });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe("EMAIL_NAO_VERIFICADO");
  });

  test("depois de verificar o e-mail, PATCH /perfil volta a funcionar normalmente", async () => {
    const usuario = await registrarUsuarioNaoVerificado("perfilLiberadoAposVerificar");
    const link = emailService.enviarVerificacaoEmail.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    await request(app).post("/verificar-email").send({ token });

    const res = await request(app)
      .patch("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ nome: "Nome Atualizado" });

    expect(res.status).toBe(200);
  });

  test("token válido confirma o e-mail e libera o acesso normal", async () => {
    const usuario = await registrarUsuarioNaoVerificado("fluxoCompleto");
    const link = emailService.enviarVerificacaoEmail.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    const confirmar = await request(app).post("/verificar-email").send({ token });
    expect(confirmar.status).toBe(200);

    const depois = await request(app)
      .get(`/organizations/${usuario.organizationId}/projects`)
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(depois.status).toBe(200);
  });

  test("token inválido/inexistente retorna 401", async () => {
    const res = await request(app)
      .post("/verificar-email")
      .send({ token: "token-forjado-de-32-caracteres-no-minimo" });

    expect(res.status).toBe(401);
  });

  test("token expirado retorna 401 e não confirma a conta", async () => {
    const usuario = await registrarUsuarioNaoVerificado("tokenExpirado");
    const link = emailService.enviarVerificacaoEmail.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    const registro = await ultimoTokenPendente(usuario.userId);
    await prisma.emailVerificationToken.update({
      where: { id: registro.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post("/verificar-email").send({ token });
    expect(res.status).toBe(401);

    const aindaBloqueado = await request(app)
      .get(`/organizations/${usuario.organizationId}/projects`)
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(aindaBloqueado.status).toBe(403);
  });

  test("token já usado não pode ser reutilizado", async () => {
    const usuario = await registrarUsuarioNaoVerificado("tokenReuso");
    const link = emailService.enviarVerificacaoEmail.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    const primeira = await request(app).post("/verificar-email").send({ token });
    expect(primeira.status).toBe(200);

    const segunda = await request(app).post("/verificar-email").send({ token });
    expect(segunda.status).toBe(401);
  });

  test("duas confirmações concorrentes com o mesmo token: só uma pode ganhar", async () => {
    const usuario = await registrarUsuarioNaoVerificado("tokenConcorrente");
    const link = emailService.enviarVerificacaoEmail.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    const [a, b] = await Promise.all([
      request(app).post("/verificar-email").send({ token }),
      request(app).post("/verificar-email").send({ token }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  test("reenvio de verificação funciona e invalida o token anterior", async () => {
    const usuario = await registrarUsuarioNaoVerificado("reenvio");
    const linkAntigo = emailService.enviarVerificacaoEmail.mock.calls[0][0].link;
    const tokenAntigo = extrairTokenDoLink(linkAntigo);

    // O cadastro já cria um token pendente (cujo createdAt é "agora") — sem
    // isso, o próprio cooldown de 60s bloquearia este primeiro reenvio.
    await empurrarCooldownParaTras(usuario.userId);

    const reenviar = await request(app)
      .post("/reenviar-verificacao")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(reenviar.status).toBe(200);
    expect(emailService.enviarVerificacaoEmail).toHaveBeenCalledTimes(2);

    // O token antigo não pode mais confirmar a conta — só o novo, enviado
    // no reenvio.
    const comTokenAntigo = await request(app).post("/verificar-email").send({ token: tokenAntigo });
    expect(comTokenAntigo.status).toBe(401);

    const linkNovo = emailService.enviarVerificacaoEmail.mock.calls[1][0].link;
    const tokenNovo = extrairTokenDoLink(linkNovo);
    const comTokenNovo = await request(app).post("/verificar-email").send({ token: tokenNovo });
    expect(comTokenNovo.status).toBe(200);
  });

  test("reenvio exige autenticação (401 sem token)", async () => {
    const res = await request(app).post("/reenviar-verificacao");
    expect(res.status).toBe(401);
  });

  test("reenvio tem proteção contra abuso: chamadas em sequência rápida são bloqueadas", async () => {
    const usuario = await registrarUsuarioNaoVerificado("reenvioAbuso");

    // Mesmo motivo do teste anterior: sem isso, o token criado no cadastro
    // (segundos atrás) já bloquearia esse "primeiro" reenvio.
    await empurrarCooldownParaTras(usuario.userId);

    const primeiro = await request(app)
      .post("/reenviar-verificacao")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(primeiro.status).toBe(200);

    // Este sim é o caso real sendo testado: chamada imediatamente depois de
    // um reenvio que acabou de criar um token com createdAt "agora".
    const segundo = await request(app)
      .post("/reenviar-verificacao")
      .set("Authorization", `Bearer ${usuario.token}`);

    expect(segundo.status).toBe(409);
    // Só o primeiro reenvio deve ter efetivamente disparado e-mail (mais o
    // do cadastro) — o segundo, bloqueado pelo cooldown, não soma mais um.
    expect(emailService.enviarVerificacaoEmail).toHaveBeenCalledTimes(2);
  });

  test("reenvio numa conta já verificada não faz nada (sem novo e-mail, sem erro)", async () => {
    // registrarUsuario() (com auto-verificação) — usada no resto da suíte —
    // é o cenário real aqui: conta já normal, apertando "reenviar" à toa.
    const usuario = await registrarUsuario("reenvioJaVerificado");

    const res = await request(app)
      .post("/reenviar-verificacao")
      .set("Authorization", `Bearer ${usuario.token}`);

    expect(res.status).toBe(200);
    // Só o e-mail do cadastro original de OUTROS testes pode ter disparado
    // o mock antes — mas para ESTE usuário específico, nenhuma chamada nova
    // de reenvio deveria ter acontecido. Como o registrarUsuario() usado
    // aqui é de outro teste (mock limpo no beforeEach), a contagem total
    // deve ser exatamente 1 (o do cadastro em si).
    expect(emailService.enviarVerificacaoEmail).toHaveBeenCalledTimes(1);
  });

  test("usuários antigos (sem o campo definido explicitamente) continuam com emailVerified: true e acesso normal — não regride quem já tinha conta", async () => {
    // Simula uma conta "antiga": cria direto no banco, sem passar pelo
    // fluxo novo de registro, pra garantir que o @default(true) do schema
    // realmente preserva o comportamento pré-existente.
    const emailAntigo = `usuarioantigo_${Date.now()}@teste.com`;

    const hash = await bcrypt.hash("senha123", 10);
    const user = await userRepository.create({
      name: "Usuario Antigo",
      email: emailAntigo,
      passwordHash: hash,
      // emailVerified NÃO informado de propósito — precisa cair no default do schema.
    });
    expect(user.emailVerified).toBe(true);

    const organization = await organizationRepository.create({
      name: "Org Antiga",
      slug: `org-antiga-${Date.now()}`,
      plan: "free",
    });
    await organizationMemberRepository.create({
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
    });

    const login = await request(app)
      .post("/login")
      .send({ email: emailAntigo, senha: "senha123" });
    expect(login.status).toBe(200);
    expect(login.body.emailVerified).toBe(true);

    const acesso = await request(app)
      .get(`/organizations/${organization.id}/projects`)
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(acesso.status).toBe(200);
  });

  test("login continua funcionando normalmente e devolve emailVerified (regressão)", async () => {
    const usuario = await registrarUsuario("loginRegressao");

    const res = await request(app)
      .post("/login")
      .send({ email: usuario.email, senha: "senha123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.organizationId).toBe(usuario.organizationId);
    expect(res.body.emailVerified).toBe(true);
  });
});