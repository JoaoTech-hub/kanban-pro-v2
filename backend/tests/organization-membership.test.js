const request = require("supertest");
const app = require("../src/app");
const { limparBanco } = require("./helpers/resetDb");
const { registrarUsuario, adicionarMembro, extrairUserIdDoToken } = require("./helpers/authHelpers");

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await limparBanco();
});

describe("DELETE /organizations/:id/members/me (sair da organização)", () => {
  test("member com 2+ organizações consegue sair com sucesso", async () => {
    const dono = await registrarUsuario("dono");
    const convidado = await registrarUsuario("convidado");
    await adicionarMembro(dono.organizationId, convidado.token, "member");

    const resposta = await request(app)
      .delete(`/organizations/${dono.organizationId}/members/me`)
      .set("Authorization", `Bearer ${convidado.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.organizacoes.map((o) => o.id)).not.toContain(dono.organizationId);
    expect(resposta.body.organizacoes.map((o) => o.id)).toContain(convidado.organizationId);
  });

  test("owner NÃO consegue sair, mesmo pertencendo a outras organizações", async () => {
    const dono = await registrarUsuario("dono2");
    const outraOrg = await registrarUsuario("outra2");
    await adicionarMembro(outraOrg.organizationId, dono.token, "member");

    const resposta = await request(app)
      .delete(`/organizations/${dono.organizationId}/members/me`)
      .set("Authorization", `Bearer ${dono.token}`);

    expect(resposta.status).toBe(403);
  });

  test("ex-owner (agora admin) consegue sair mesmo sendo sua única organização, após transferir a propriedade", async () => {
    // Cenário relatado: A é owner, B é admin, A transfere a organização
    // pra B (A vira admin). A tenta sair — mesmo sendo a única organização
    // de A, isso agora é permitido: a regra de "não pode sair da última
    // organização" foi removida deliberadamente (só o bloqueio de owner
    // continua existindo). Antes dessa correção, A ficava preso — só
    // conseguia sair da organização se B o removesse manualmente.
    const donoOriginal = await registrarUsuario("exOwnerA");
    const futuroDono = await registrarUsuario("futuroDonoB");
    await adicionarMembro(donoOriginal.organizationId, futuroDono.token, "admin");

    const transferencia = await request(app)
      .post(`/organizations/${donoOriginal.organizationId}/members/transfer-ownership`)
      .set("Authorization", `Bearer ${donoOriginal.token}`)
      .send({ novoOwnerUserId: extrairUserIdDoToken(futuroDono.token) });
    expect(transferencia.status).toBe(204);

    const resposta = await request(app)
      .delete(`/organizations/${donoOriginal.organizationId}/members/me`)
      .set("Authorization", `Bearer ${donoOriginal.token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.organizacoes).toEqual([]);
  });

  test("após sair, o ex-membro perde acesso às rotas da organização (403)", async () => {
    const dono = await registrarUsuario("dono4");
    const convidado = await registrarUsuario("convidado4");
    await adicionarMembro(dono.organizationId, convidado.token, "member");

    await request(app)
      .delete(`/organizations/${dono.organizationId}/members/me`)
      .set("Authorization", `Bearer ${convidado.token}`);

    const tentativaPosSaida = await request(app)
      .get(`/organizations/${dono.organizationId}/members`)
      .set("Authorization", `Bearer ${convidado.token}`);

    expect(tentativaPosSaida.status).toBe(403);
  });

});

describe("POST /organizations/:id/members/transfer-ownership", () => {
  test("owner transfere com sucesso diretamente para um member (sem exigir admin antes)", async () => {
    const dono = await registrarUsuario("transfDono");
    const convidado = await registrarUsuario("transfConvidado");
    await adicionarMembro(dono.organizationId, convidado.token, "member");
    const donoUserId = extrairUserIdDoToken(dono.token);
    const novoOwnerUserId = extrairUserIdDoToken(convidado.token);

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/members/transfer-ownership`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ novoOwnerUserId });

    expect(resposta.status).toBe(204);

    const membros = await request(app)
      .get(`/organizations/${dono.organizationId}/members`)
      .set("Authorization", `Bearer ${dono.token}`);

    // Comparamos por userId (campo confirmado na resposta de listarMembros),
    // não por email — registrarUsuario não garante retornar esse campo, e
    // usar algo que não existe faria o .find() nunca casar (foi exatamente
    // o bug do primeiro run deste teste: antigoDono vinha undefined).
    const antigoDono = membros.body.find((m) => m.userId === donoUserId);
    const novoDono = membros.body.find((m) => m.userId === novoOwnerUserId);
    expect(antigoDono.role).toBe("admin");
    expect(novoDono.role).toBe("owner");
  });

  test("admin NÃO consegue transferir ownership (só o owner pode)", async () => {
    const dono = await registrarUsuario("transfDono2");
    const admin = await registrarUsuario("transfAdmin2");
    const alvo = await registrarUsuario("transfAlvo2");
    await adicionarMembro(dono.organizationId, admin.token, "admin");
    await adicionarMembro(dono.organizationId, alvo.token, "member");
    const alvoUserId = extrairUserIdDoToken(alvo.token);

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/members/transfer-ownership`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ novoOwnerUserId: alvoUserId });

    expect(resposta.status).toBe(403);
  });

  test("transferir para um userId que não é membro da organização -> 404 (proteção contra IDOR)", async () => {
    const dono = await registrarUsuario("transfDono3");
    const forasteiro = await registrarUsuario("transfForasteiro3"); // nunca foi adicionado a essa org
    const forasteiroUserId = extrairUserIdDoToken(forasteiro.token);

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/members/transfer-ownership`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ novoOwnerUserId: forasteiroUserId });

    expect(resposta.status).toBe(404);
  });

  test("payload com novoOwnerUserId ausente ou inválido -> 400", async () => {
    const dono = await registrarUsuario("transfDono4");

    const resposta = await request(app)
      .post(`/organizations/${dono.organizationId}/members/transfer-ownership`)
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ novoOwnerUserId: "nao-e-um-uuid" });

    expect(resposta.status).toBe(400);
  });
});