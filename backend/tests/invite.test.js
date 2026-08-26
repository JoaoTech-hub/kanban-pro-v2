const request = require("supertest");
const app = require("../src/app");
const { limparBanco, prisma } = require("./helpers/resetDb");
const { registrarUsuario, adicionarMembro, extrairUserIdDoToken } = require("./helpers/authHelpers");
const organizationRepository = require("../src/repositories/organization.repository");
const inviteService = require("../src/services/invite.service");

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await limparBanco();
});

// Cria um convite chamando o service diretamente — mesmo padrão já usado em
// invite-plan-limit.test.js, útil para testes que precisam de um token
// válido sem depender do comportamento da rota HTTP de criação em si (essa
// já é testada isoladamente no describe abaixo).
async function criarConviteDireto(organizationId, donoToken, email, role = "member") {
  const organization = await organizationRepository.findById(organizationId);
  const { invite, tokenBruto } = await inviteService.criar({
    organization,
    organizationRole: "owner",
    invitedById: extrairUserIdDoToken(donoToken),
    email: email.trim().toLowerCase(),
    role,
  });
  return { invite, tokenBruto };
}

describe("POST /organizations/:id/invites (criar convite)", () => {
  test("owner cria um convite com sucesso", async () => {
    const dono = await registrarUsuario("criarConviteDono1");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: "convidado1@teste.com", role: "member" });

    expect(resposta.status).toBe(201);
    expect(resposta.body.email).toBe("convidado1@teste.com");
    expect(resposta.body.role).toBe("member");
    expect(resposta.body.id).toBeDefined();

    const registro = await prisma.organizationInvite.findUnique({ where: { id: resposta.body.id } });
    expect(registro.organizationId).toBe(dono.organizationId);
    expect(registro.acceptedAt).toBeNull();
    expect(registro.revokedAt).toBeNull();
  });

  test("admin cria um convite com sucesso", async () => {
    const dono = await registrarUsuario("criarConviteDono2");
    const admin = await registrarUsuario("criarConviteAdmin2");
    await adicionarMembro(dono.organizationId, admin.token, "admin");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: "convidado2@teste.com" });

    expect(resposta.status).toBe(201);
    // role omitido -> default "member" (conviteSchema)
    expect(resposta.body.role).toBe("member");
  });

  test("member NÃO pode criar convite (403)", async () => {
    const dono = await registrarUsuario("criarConviteDono3");
    const membro = await registrarUsuario("criarConviteMembro3");
    await adicionarMembro(dono.organizationId, membro.token, "member");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${membro.token}`)
      .send({ email: "convidado3@teste.com" });

    expect(resposta.status).toBe(403);
  });

  test("admin NÃO pode conceder role admin no convite (403) — só o owner concede admin", async () => {
    const dono = await registrarUsuario("criarConviteDono4");
    const admin = await registrarUsuario("criarConviteAdmin4");
    await adicionarMembro(dono.organizationId, admin.token, "admin");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: "convidado4@teste.com", role: "admin" });

    expect(resposta.status).toBe(403);
  });

  test("owner PODE conceder role admin no convite", async () => {
    const dono = await registrarUsuario("criarConviteDono5");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: "convidado5@teste.com", role: "admin" });

    expect(resposta.status).toBe(201);
    expect(resposta.body.role).toBe("admin");
  });

  test("400 ao tentar conceder role 'owner' (nunca é aceito vindo do client)", async () => {
    const dono = await registrarUsuario("criarConviteDono6");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: "convidado6@teste.com", role: "owner" });

    expect(resposta.status).toBe(400);
  });

  test("400 com e-mail inválido", async () => {
    const dono = await registrarUsuario("criarConviteDono7");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: "isso-nao-e-um-email" });

    expect(resposta.status).toBe(400);
  });

  test("409 ao convidar um e-mail que já pertence à organização", async () => {
    const dono = await registrarUsuario("criarConviteDono8");
    const jaMembro = await registrarUsuario("criarConviteJaMembro8");
    await adicionarMembro(dono.organizationId, jaMembro.token, "member");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: jaMembro.email });

    expect(resposta.status).toBe(409);
  });

  test("criar um segundo convite pro mesmo e-mail invalida o convite anterior (não dá pra aceitar o antigo depois)", async () => {
    const dono = await registrarUsuario("criarConviteDono9");
    const { tokenBruto: tokenAntigo } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "duplicado9@teste.com"
    );

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ email: "duplicado9@teste.com" });

    expect(resposta.status).toBe(201);

    // O convite ANTIGO não pode mais ser usado — foi revogado automaticamente.
    const tentativaComAntigo = await request(app)
      .post(`/convites/${tokenAntigo}/aceitar-novo`)
      .send({ nome: "Convidado", senha: "senha123" });

    expect(tentativaComAntigo.status).toBe(401);
  });
});

describe("GET /organizations/:id/invites (listarPendentes)", () => {
  test("lista os convites pendentes da organização, com dados de quem convidou", async () => {
    const dono = await registrarUsuario("listarConvitesDono1");
    await criarConviteDireto(dono.organizationId, dono.token, "pendente1@teste.com");
    await criarConviteDireto(dono.organizationId, dono.token, "pendente2@teste.com");

    const resposta = await request(app)
      .get(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveLength(2);
    const emails = resposta.body.map((c) => c.email).sort();
    expect(emails).toEqual(["pendente1@teste.com", "pendente2@teste.com"]);
    expect(resposta.body[0].invitedBy.name).toBeDefined();
  });

  test("não inclui convites já revogados, já aceitos ou expirados", async () => {
    const dono = await registrarUsuario("listarConvitesDono2");

    const { invite: conviteRevogado } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "revogado@teste.com"
    );
    await prisma.organizationInvite.update({
      where: { id: conviteRevogado.id },
      data: { revokedAt: new Date() },
    });

    const { invite: conviteExpirado } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "expirado@teste.com"
    );
    await prisma.organizationInvite.update({
      where: { id: conviteExpirado.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await criarConviteDireto(dono.organizationId, dono.token, "aindaPendente@teste.com");

    const resposta = await request(app)
      .get(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${dono.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].email).toBe("aindapendente@teste.com");
  });

  test("member também consegue listar os convites pendentes (não é uma ação gerencial)", async () => {
    const dono = await registrarUsuario("listarConvitesDono3");
    const membro = await registrarUsuario("listarConvitesMembro3");
    await adicionarMembro(dono.organizationId, membro.token, "member");
    await criarConviteDireto(dono.organizationId, dono.token, "visivel@teste.com");

    const resposta = await request(app)
      .get(`/organizations/${dono.organizationId}/invites`)
      .set("Authorization", `Bearer ${membro.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toHaveLength(1);
  });

  test("403 para quem não pertence à organização", async () => {
    const donoA = await registrarUsuario("listarConvitesIsolA");
    const donoB = await registrarUsuario("listarConvitesIsolB");

    const resposta = await request(app)
      .get(`/organizations/${donoA.organizationId}/invites`)
      .set("Authorization", `Bearer ${donoB.token}`);

    expect(resposta.status).toBe(403);
  });
});

describe("DELETE /organizations/:id/invites/:inviteId (revogar)", () => {
  test("owner revoga um convite pendente com sucesso", async () => {
    const dono = await registrarUsuario("revogarDono1");
    const { invite } = await criarConviteDireto(dono.organizationId, dono.token, "revogar1@teste.com");

    const resposta = await request(app)
      .delete(`/organizations/${dono.organizationId}/invites/${invite.id}`)
      .set("Authorization", `Bearer ${dono.token}`);

    expect(resposta.status).toBe(204);
    const registro = await prisma.organizationInvite.findUnique({ where: { id: invite.id } });
    expect(registro.revokedAt).not.toBeNull();
  });

  test("admin revoga um convite pendente com sucesso", async () => {
    const dono = await registrarUsuario("revogarDono2");
    const admin = await registrarUsuario("revogarAdmin2");
    await adicionarMembro(dono.organizationId, admin.token, "admin");
    const { invite } = await criarConviteDireto(dono.organizationId, dono.token, "revogar2@teste.com");

    const resposta = await request(app)
      .delete(`/organizations/${dono.organizationId}/invites/${invite.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(resposta.status).toBe(204);
  });

  test("member NÃO pode revogar convite (403)", async () => {
    const dono = await registrarUsuario("revogarDono3");
    const membro = await registrarUsuario("revogarMembro3");
    await adicionarMembro(dono.organizationId, membro.token, "member");
    const { invite } = await criarConviteDireto(dono.organizationId, dono.token, "revogar3@teste.com");

    const resposta = await request(app)
      .delete(`/organizations/${dono.organizationId}/invites/${invite.id}`)
      .set("Authorization", `Bearer ${membro.token}`);

    expect(resposta.status).toBe(403);
    const registro = await prisma.organizationInvite.findUnique({ where: { id: invite.id } });
    expect(registro.revokedAt).toBeNull();
  });

  test("404 ao revogar um convite inexistente ou já revogado", async () => {
    const dono = await registrarUsuario("revogarDono4");
    const { invite } = await criarConviteDireto(dono.organizationId, dono.token, "revogar4@teste.com");

    const primeira = await request(app)
      .delete(`/organizations/${dono.organizationId}/invites/${invite.id}`)
      .set("Authorization", `Bearer ${dono.token}`);
    expect(primeira.status).toBe(204);

    const segunda = await request(app)
      .delete(`/organizations/${dono.organizationId}/invites/${invite.id}`)
      .set("Authorization", `Bearer ${dono.token}`);
    expect(segunda.status).toBe(404);
  });

  test("depois de revogado, o token não pode mais ser aceito", async () => {
    const dono = await registrarUsuario("revogarDono5");
    const { invite, tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "revogar5@teste.com"
    );

    await request(app)
      .delete(`/organizations/${dono.organizationId}/invites/${invite.id}`)
      .set("Authorization", `Bearer ${dono.token}`);

    const tentativa = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-novo`)
      .send({ nome: "Convidado", senha: "senha123" });

    expect(tentativa.status).toBe(401);
  });
});

describe("GET /convites/:token (buscarPorToken — rota pública)", () => {
  test("retorna os dados públicos do convite pra um token válido", async () => {
    const dono = await registrarUsuario("buscarTokenDono1");
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "buscartoken1@teste.com",
      "admin"
    );

    const resposta = await request(app).get(`/convites/${tokenBruto}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.email).toBe("buscartoken1@teste.com");
    expect(resposta.body.role).toBe("admin");
    expect(resposta.body.contaExistente).toBe(false);
    expect(resposta.body.nomeOrganizacao).toBeDefined();
    expect(resposta.body.nomeConvidante).toBeDefined();
  });

  test("contaExistente é true quando o e-mail convidado já tem conta (mas ainda não é membro)", async () => {
    const dono = await registrarUsuario("buscarTokenDono2");
    const forasteiro = await registrarUsuario("buscarTokenForasteiro2");
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      forasteiro.email
    );

    const resposta = await request(app).get(`/convites/${tokenBruto}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.contaExistente).toBe(true);
  });

  test("401 para um token inexistente", async () => {
    const resposta = await request(app).get(`/convites/token-que-nao-existe`);

    expect(resposta.status).toBe(401);
  });

  test("401 para um token expirado", async () => {
    const dono = await registrarUsuario("buscarTokenDono3");
    const { invite, tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "expirado3@teste.com"
    );
    await prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resposta = await request(app).get(`/convites/${tokenBruto}`);

    expect(resposta.status).toBe(401);
  });

  test("401 para um token já aceito", async () => {
    const dono = await registrarUsuario("buscarTokenDono4");
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "jaaceito4@teste.com"
    );
    await request(app)
      .post(`/convites/${tokenBruto}/aceitar-novo`)
      .send({ nome: "Convidado", senha: "senha123" });

    const resposta = await request(app).get(`/convites/${tokenBruto}`);

    expect(resposta.status).toBe(401);
  });
});

describe("Regras específicas do ciclo de aceite", () => {
  test("401 ao tentar aceitar (conta nova) um convite expirado", async () => {
    const dono = await registrarUsuario("aceitarExpiradoDono1");
    const { invite, tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "aceitarexpirado1@teste.com"
    );
    await prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resposta = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-novo`)
      .send({ nome: "Convidado", senha: "senha123" });

    expect(resposta.status).toBe(401);
    const usuario = await prisma.user.findUnique({ where: { email: "aceitarexpirado1@teste.com" } });
    expect(usuario).toBeNull();
  });

  test("401 ao tentar aceitar o mesmo convite (conta nova) uma segunda vez", async () => {
    const dono = await registrarUsuario("aceitarDuasVezesDono1");
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      "duasvezes1@teste.com"
    );

    const primeira = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-novo`)
      .send({ nome: "Convidado", senha: "senha123" });
    expect(primeira.status).toBe(201);

    const segunda = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-novo`)
      .send({ nome: "Outro Nome", senha: "outrasenha123" });
    expect(segunda.status).toBe(401);

    const total = await prisma.organizationMember.count({ where: { organizationId: dono.organizationId } });
    expect(total).toBe(2); // dono + o único aceite válido
  });

  test("403 ao aceitar (conta existente) logado com uma conta cujo e-mail não bate com o convite", async () => {
    const dono = await registrarUsuario("aceitarExistenteErradoDono1");
    const forasteiro = await registrarUsuario("aceitarExistenteErradoForasteiro1");
    const outraPessoa = await registrarUsuario("aceitarExistenteErradoOutra1");
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      forasteiro.email // convite é pro e-mail do forasteiro
    );

    // outraPessoa (e-mail diferente) tenta aceitar o convite do forasteiro
    const resposta = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-existente`)
      .set("Authorization", `Bearer ${outraPessoa.token}`);

    expect(resposta.status).toBe(403);
    const membro = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dono.organizationId,
          userId: extrairUserIdDoToken(outraPessoa.token),
        },
      },
    });
    expect(membro).toBeNull();
  });

  test("409 ao aceitar (conta existente) um convite pra uma organização da qual a pessoa já é membro", async () => {
    const dono = await registrarUsuario("aceitarExistenteJaMembroDono1");
    const jaMembro = await registrarUsuario("aceitarExistenteJaMembro1");

    // O convite é criado ENQUANTO jaMembro ainda não pertence à organização
    // — se a ordem fosse invertida, a própria criação do convite já seria
    // bloqueada por criar() ("Este e-mail já pertence à organização"),
    // nunca chegando a testar o que este cenário quer: o 409 no momento de
    // ACEITAR, não no momento de convidar.
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      jaMembro.email,
      "admin"
    );

    // Só DEPOIS jaMembro se torna membro (por outro caminho, ex.: adicionada
    // diretamente) — o convite continua pendente/válido, mas a pessoa já é
    // membro no momento em que tenta aceitá-lo.
    await adicionarMembro(dono.organizationId, jaMembro.token, "member");

    const resposta = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-existente`)
      .set("Authorization", `Bearer ${jaMembro.token}`);

    expect(resposta.status).toBe(409);
    // A role não deve ter sido alterada pra "admin" por essa tentativa.
    const membro = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dono.organizationId,
          userId: extrairUserIdDoToken(jaMembro.token),
        },
      },
    });
    expect(membro.role).toBe("member");
  });

  test("aceitar (conta existente) com sucesso vincula a pessoa com a role definida no convite", async () => {
    const dono = await registrarUsuario("aceitarExistenteSucessoDono1");
    const forasteiro = await registrarUsuario("aceitarExistenteSucessoForasteiro1");
    const { tokenBruto } = await criarConviteDireto(
      dono.organizationId,
      dono.token,
      forasteiro.email,
      "admin"
    );

    const resposta = await request(app)
      .post(`/convites/${tokenBruto}/aceitar-existente`)
      .set("Authorization", `Bearer ${forasteiro.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.organizationId).toBe(dono.organizationId);

    const membro = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dono.organizationId,
          userId: extrairUserIdDoToken(forasteiro.token),
        },
      },
    });
    expect(membro.role).toBe("admin");
  });
});