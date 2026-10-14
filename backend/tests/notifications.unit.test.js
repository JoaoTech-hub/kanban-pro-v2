require("./helpers/loadTestEnvironment").carregarAmbienteTeste();
process.env.NODE_ENV = "test";

const mocks = {
  prisma: { $transaction: jest.fn() },
  inviteRepository: {
    findValidByToken: jest.fn(),
    findValidById: jest.fn(),
    markAsAcceptedIfValid: jest.fn(),
    invalidatePendingForEmail: jest.fn(),
    create: jest.fn(),
  },
  notificationRepository: { create: jest.fn() },
  memberRepository: {
    findByUserAndOrg: jest.fn(),
    create: jest.fn(),
    countByOrganization: jest.fn(),
  },
  userRepository: { findByEmail: jest.fn(), findById: jest.fn(), create: jest.fn() },
  organizationRepository: { lockForUpdate: jest.fn() },
  emailService: { enviarConvite: jest.fn() },
};

function carregarInviteService() {
  jest.resetModules();
  jest.doMock("../src/config/db", () => mocks.prisma);
  jest.doMock("../src/repositories/organizationInvite.repository", () => mocks.inviteRepository);
  jest.doMock("../src/repositories/notification.repository", () => mocks.notificationRepository);
  jest.doMock("../src/repositories/organizationMember.repository", () => mocks.memberRepository);
  jest.doMock("../src/repositories/user.repository", () => mocks.userRepository);
  jest.doMock("../src/repositories/organization.repository", () => mocks.organizationRepository);
  jest.doMock("../src/services/email/emailService", () => mocks.emailService);
  return require("../src/services/invite.service");
}

function resetMocks() {
  Object.values(mocks).forEach((group) => {
    Object.values(group).forEach((mock) => mock.mockReset());
  });
  mocks.prisma.$transaction.mockImplementation(async (callback) => callback({ transaction: true }));
  mocks.inviteRepository.markAsAcceptedIfValid.mockResolvedValue(true);
  mocks.memberRepository.findByUserAndOrg.mockResolvedValue(null);
  mocks.memberRepository.create.mockResolvedValue({});
  mocks.userRepository.findByEmail.mockResolvedValue({ id: "user-invitee", email: "invitee@example.test" });
  mocks.userRepository.findById.mockResolvedValue({ id: "user-invitee", email: "invitee@example.test", name: "Convidado" });
  mocks.inviteRepository.create.mockResolvedValue({ id: "invite-1", organizationId: "org-1" });
  mocks.notificationRepository.create.mockResolvedValue({ id: "notice-1" });
}

const invite = {
  id: "invite-1",
  organizationId: "org-1",
  email: "invitee@example.test",
  role: "member",
  invitedById: "user-owner",
  organization: { id: "org-1", name: "Produto", plan: "pro" },
};

describe("invite/notification unit safety", () => {
  beforeEach(() => resetMocks());
  afterEach(() => jest.restoreAllMocks());

  test("notifica conta existente ao criar convite sem armazenar token bruto", async () => {
    mocks.inviteRepository.create.mockResolvedValue(invite);
    mocks.inviteRepository.invalidatePendingForEmail.mockResolvedValue({ count: 0 });
    const service = carregarInviteService();

    await service.criar({
      organization: invite.organization,
      organizationRole: "owner",
      invitedById: invite.invitedById,
      email: invite.email,
      role: invite.role,
    });

    expect(mocks.notificationRepository.create).toHaveBeenCalledWith({
      userId: "user-invitee",
      message: "Você foi convidado para Produto.",
      type: "invite_received",
      inviteId: "invite-1",
    });
    expect(mocks.notificationRepository.create.mock.calls[0][0]).not.toHaveProperty("token");
  });

  test("falha ao criar notificação de aceite não falha o aceite já commitado", async () => {
    mocks.inviteRepository.findValidById.mockResolvedValue(invite);
    mocks.notificationRepository.create.mockRejectedValueOnce(new Error("persistência indisponível"));
    const logErro = jest.spyOn(console, "error").mockImplementation(() => {});
    const service = carregarInviteService();

    await expect(service.aceitarContaExistentePorId("invite-1", "user-invitee"))
      .resolves.toEqual({ organizationId: "org-1" });

    expect(mocks.inviteRepository.markAsAcceptedIfValid).toHaveBeenCalledWith("invite-1", { transaction: true });
    expect(mocks.memberRepository.create).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-invitee",
      role: "member",
    }, { transaction: true });
    expect(mocks.notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      type: "invite_accepted",
      inviteId: "invite-1",
    }));
    expect(logErro).toHaveBeenCalled();
  });

  test("não cria notificação quando a transação essencial do aceite falha", async () => {
    mocks.inviteRepository.findValidById.mockResolvedValue(invite);
    mocks.inviteRepository.markAsAcceptedIfValid.mockResolvedValue(false);
    const service = carregarInviteService();

    await expect(service.aceitarContaExistentePorId("invite-1", "user-invitee"))
      .rejects.toThrow("Convite inválido, expirado ou já utilizado");

    expect(mocks.memberRepository.create).not.toHaveBeenCalled();
    expect(mocks.notificationRepository.create).not.toHaveBeenCalled();
  });
});
