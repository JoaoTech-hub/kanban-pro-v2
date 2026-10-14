const request = require("supertest");
const app = require("../src/app");
const { limparBanco, prisma } = require("./helpers/resetDb");
const { registrarUsuario, extrairUserIdDoToken } = require("./helpers/authHelpers");
const organizationRepository = require("../src/repositories/organization.repository");
const notificationRepository = require("../src/repositories/notification.repository");
const inviteService = require("../src/services/invite.service");

beforeEach(async () => {
  await limparBanco();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await limparBanco();
});

async function criarConvite(organizacaoId, tokenDono, email) {
  const organization = await organizationRepository.findById(organizacaoId);
  return inviteService.criar({
    organization,
    organizationRole: "owner",
    invitedById: extrairUserIdDoToken(tokenDono),
    email,
    role: "member",
  });
}

async function notificationDoConvite(userId, inviteId) {
  return prisma.notification.findFirst({
    where: { userId, inviteId, type: "invite_received" },
  });
}

describe("Notificações de convite", () => {
  test("cria notificação para conta existente e preserva o envio do convite se a notificação falhar", async () => {
    const dono = await registrarUsuario("notification-owner");
    const convidado = await registrarUsuario("notification-recipient");
    const organization = await organizationRepository.findById(dono.organizationId);

    const falhaNotificacao = jest.spyOn(notificationRepository, "create")
      .mockRejectedValueOnce(new Error("falha simulada de persistência"));
    const enviarEmail = jest.spyOn(inviteService, "enviarEmailConvite").mockResolvedValue();

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: convidado.email, role: "member" });

    expect(resposta.status).toBe(201);
    expect(falhaNotificacao).toHaveBeenCalled();
    expect(enviarEmail).toHaveBeenCalled();

    const invite = await prisma.organizationInvite.findUnique({ where: { id: resposta.body.id } });
    expect(invite).not.toBeNull();
    expect(await notificationDoConvite(extrairUserIdDoToken(convidado.token), invite.id)).toBeNull();

    // Reenvia um convite de forma bem-sucedida para confirmar os dados persistidos.
    const criado = await criarConvite(dono.organizationId, dono.token, convidado.email);
    const notification = await notificationDoConvite(extrairUserIdDoToken(convidado.token), criado.invite.id);
    expect(notification.message).toContain(organization.name);
    expect(notification.type).toBe("invite_received");
  });

  test("não duplica notificação para o mesmo usuário, convite e evento", async () => {
    const dono = await registrarUsuario("notification-duplicate-owner");
    const convidado = await registrarUsuario("notification-duplicate-recipient");
    const { invite } = await criarConvite(dono.organizationId, dono.token, convidado.email);
    const userId = extrairUserIdDoToken(convidado.token);

    await notificationRepository.create({
      userId,
      inviteId: invite.id,
      type: "invite_received",
      message: "Mensagem atualizada",
    });

    const notices = await prisma.notification.findMany({ where: { userId, inviteId: invite.id } });
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toBe("Mensagem atualizada");
  });

  test("usuários só listam e marcam as próprias notificações, individualmente ou em lote", async () => {
    const donoA = await registrarUsuario("notification-owner-a");
    const donoB = await registrarUsuario("notification-owner-b");
    const alice = await registrarUsuario("notification-alice");
    const bob = await registrarUsuario("notification-bob");
    const inviteA = await criarConvite(donoA.organizationId, donoA.token, alice.email);
    const inviteB = await criarConvite(donoB.organizationId, donoB.token, bob.email);
    const aliceId = extrairUserIdDoToken(alice.token);
    const bobId = extrairUserIdDoToken(bob.token);
    const noticeAlice = await notificationDoConvite(aliceId, inviteA.invite.id);
    const noticeBob = await notificationDoConvite(bobId, inviteB.invite.id);

    const listaAlice = await request(app).get("/notifications")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(listaAlice.status).toBe(200);
    expect(listaAlice.body.notifications.map((item) => item.id)).toEqual([noticeAlice.id]);
    expect(listaAlice.body.notifications[0].invite.organization.name).toBeDefined();

    const listaBob = await request(app).get("/notifications")
      .set("Authorization", `Bearer ${bob.token}`);
    expect(listaBob.body.notifications.map((item) => item.id)).toEqual([noticeBob.id]);

    const acessoAlheio = await request(app).patch(`/notifications/${noticeAlice.id}/read`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(acessoAlheio.status).toBe(404);

    const marcada = await request(app).patch(`/notifications/${noticeAlice.id}/read`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(marcada.status).toBe(204);

    await prisma.notification.create({
      data: { userId: aliceId, message: "Outra mensagem", type: "general" },
    });
    const todasLidas = await request(app).patch("/notifications/read-all")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(todasLidas.status).toBe(204);

    const estadoAlice = await prisma.notification.findMany({ where: { userId: aliceId } });
    const estadoBob = await prisma.notification.findMany({ where: { userId: bobId } });
    expect(estadoAlice.every((item) => item.readAt)).toBe(true);
    expect(estadoBob.every((item) => item.readAt === null)).toBe(true);
  });

  test("rotas de notificação rejeitam usuário sem autenticação", async () => {
    expect((await request(app).get("/notifications")).status).toBe(401);
    expect((await request(app).patch("/notifications/read-all")).status).toBe(401);
    expect((await request(app).post("/notifications/id/accept-invite")).status).toBe(401);
  });

  test("aceita convite válido pelo usuário destinatário e atualiza vínculo e leitura", async () => {
    const dono = await registrarUsuario("notification-accept-owner");
    const convidado = await registrarUsuario("notification-accept-recipient");
    const { invite } = await criarConvite(dono.organizationId, dono.token, convidado.email);
    const userId = extrairUserIdDoToken(convidado.token);
    const notice = await notificationDoConvite(userId, invite.id);

    const resposta = await request(app).post(`/notifications/${notice.id}/accept-invite`)
      .set("Authorization", `Bearer ${convidado.token}`);
    expect(resposta.status).toBe(200);
    expect(resposta.body.organizationId).toBe(dono.organizationId);

    const [registroInvite, membership, registroNotice, confirmacaoAoDono] = await Promise.all([
      prisma.organizationInvite.findUnique({ where: { id: invite.id } }),
      prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: dono.organizationId, userId } },
      }),
      prisma.notification.findUnique({ where: { id: notice.id } }),
      prisma.notification.findFirst({
        where: {
          userId: extrairUserIdDoToken(dono.token),
          inviteId: invite.id,
          type: "invite_accepted",
        },
      }),
    ]);
    expect(registroInvite.acceptedAt).not.toBeNull();
    expect(membership).not.toBeNull();
    expect(registroNotice.readAt).not.toBeNull();
    expect(confirmacaoAoDono).not.toBeNull();
  });

  test("bloqueia uso da notificação por outra conta e destinatário com e-mail divergente", async () => {
    const dono = await registrarUsuario("notification-forbidden-owner");
    const destinatario = await registrarUsuario("notification-forbidden-recipient");
    const terceiro = await registrarUsuario("notification-forbidden-third");
    const { invite } = await criarConvite(dono.organizationId, dono.token, destinatario.email);
    const recipientId = extrairUserIdDoToken(destinatario.token);
    const thirdId = extrairUserIdDoToken(terceiro.token);
    const notice = await notificationDoConvite(recipientId, invite.id);

    const alheio = await request(app).post(`/notifications/${notice.id}/accept-invite`)
      .set("Authorization", `Bearer ${terceiro.token}`);
    expect(alheio.status).toBe(404);

    const noticeComDestinatarioIncorreto = await notificationRepository.create({
      userId: thirdId,
      inviteId: invite.id,
      type: "invite_received",
      message: "Convite não destinado a esta conta",
    });
    const divergente = await request(app)
      .post(`/notifications/${noticeComDestinatarioIncorreto.id}/accept-invite`)
      .set("Authorization", `Bearer ${terceiro.token}`);
    expect(divergente.status).toBe(403);
    expect((await prisma.organizationInvite.findUnique({ where: { id: invite.id } })).acceptedAt).toBeNull();
  });

  test("rejeita convite expirado ou já utilizado pelo botão de notificação", async () => {
    const dono = await registrarUsuario("notification-expired-owner");
    const expirado = await registrarUsuario("notification-expired-recipient");
    const usado = await registrarUsuario("notification-used-recipient");
    const conviteExpirado = await criarConvite(dono.organizationId, dono.token, expirado.email);
    const conviteUsado = await criarConvite(dono.organizationId, dono.token, usado.email);
    const avisoExpirado = await notificationDoConvite(extrairUserIdDoToken(expirado.token), conviteExpirado.invite.id);
    const avisoUsado = await notificationDoConvite(extrairUserIdDoToken(usado.token), conviteUsado.invite.id);

    await prisma.organizationInvite.update({
      where: { id: conviteExpirado.invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const rejeitadoExpirado = await request(app)
      .post(`/notifications/${avisoExpirado.id}/accept-invite`)
      .set("Authorization", `Bearer ${expirado.token}`);
    expect(rejeitadoExpirado.status).toBe(401);

    const aceiteTradicional = await request(app)
      .post(`/convites/${conviteUsado.tokenBruto}/aceitar-existente`)
      .set("Authorization", `Bearer ${usado.token}`);
    expect(aceiteTradicional.status).toBe(200);
    const repetido = await request(app)
      .post(`/notifications/${avisoUsado.id}/accept-invite`)
      .set("Authorization", `Bearer ${usado.token}`);
    expect(repetido.status).toBe(401);
  });

  test("falha ao criar notificação de aceite não cancela o convite nem o vínculo", async () => {
    const dono = await registrarUsuario("notification-failure-owner");
    const convidado = await registrarUsuario("notification-failure-recipient");
    const { invite } = await criarConvite(dono.organizationId, dono.token, convidado.email);
    const notice = await notificationDoConvite(extrairUserIdDoToken(convidado.token), invite.id);
    jest.spyOn(notificationRepository, "create").mockRejectedValueOnce(new Error("falha simulada"));

    const resposta = await request(app).post(`/notifications/${notice.id}/accept-invite`)
      .set("Authorization", `Bearer ${convidado.token}`);
    expect(resposta.status).toBe(200);
    expect((await prisma.organizationInvite.findUnique({ where: { id: invite.id } })).acceptedAt).not.toBeNull();
    expect(await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dono.organizationId,
          userId: extrairUserIdDoToken(convidado.token),
        },
      },
    })).not.toBeNull();
  });
});
