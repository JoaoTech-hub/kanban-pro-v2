const request = require("supertest");
const app = require("../src/app");
const { limparBanco, prisma } = require("./helpers/resetDb");
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


describe("Fase C — concorrência em alterarRole/removerMembro sobre o mesmo membro-alvo", () => {
  test(
    "REGRESSÃO CRÍTICA: admin removendo um membro NUNCA pode ter sucesso se, no momento real da escrita, esse membro já é admin (promovido concorrentemente pelo owner)",
    async () => {
      const dono = await registrarUsuario("racaDono");
      const admin1 = await registrarUsuario("racaAdmin1");
      const alvo = await registrarUsuario("racaAlvo");

      await adicionarMembro(dono.organizationId, admin1.token, "admin");
      await adicionarMembro(dono.organizationId, alvo.token, "member");

      const alvoUserId = extrairUserIdDoToken(alvo.token);

      // Admin1 tenta remover `alvo` (autorizado, hoje `alvo` é "member") ao
      // mesmo tempo em que o dono promove `alvo` a "admin". Antes da
      // correção, a remoção de Admin1 era incondicional (memberRepository.remove
      // não checava a role no momento da escrita) — ou seja, teria sucesso
      // MESMO que a promoção do dono já tivesse sido aplicada, violando a
      // regra "só o owner mexe em admin" (garantirPodeGerenciarMembro).
      const [respostaRemover, respostaAlterar] = await Promise.all([
        request(app)
          .delete(`/organizations/${dono.organizationId}/members/${alvoUserId}`)
          .set("Authorization", `Bearer ${admin1.token}`),
        request(app)
          .patch(`/organizations/${dono.organizationId}/members/${alvoUserId}`)
          .set("Authorization", `Bearer ${dono.token}`)
          .send({ role: "admin" }),
      ]);

      // Nunca pode acontecer as duas terem sucesso simultaneamente — isso
      // significaria que `alvo` foi removido por um admin exatamente no
      // instante em que já era admin.
      const ambasComSucesso =
        [200, 204].includes(respostaRemover.status) && [200, 204].includes(respostaAlterar.status);
      expect(ambasComSucesso).toBe(false);

      const membroFinal = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: dono.organizationId, userId: alvoUserId } },
      });

      if (membroFinal === null) {
        // Admin1 removeu primeiro — a atualização do dono, rodando depois,
        // não pode ter aplicado uma mudança de role num membro que não
        // existe mais. Pode ter sido barrada de dois jeitos igualmente
        // seguros: 404 (a própria leitura inicial do dono já não achou
        // ninguém) ou 409 (o dono leu o membro ainda presente, mas a escrita
        // dele rodou só depois que a remoção de Admin1 já tinha comitado).
        expect(respostaRemover.status).toBe(204);
        expect([404, 409]).toContain(respostaAlterar.status);
      } else {
        // A promoção do dono venceu a corrida (ou terminou antes da escrita
        // de Admin1, ou entre a leitura e a escrita dele) — `alvo` tem que
        // ter sobrevivido exatamente como "admin", nunca removido nem
        // deixado como "member" (o que seria a promoção perdida em silêncio).
        expect(membroFinal.role).toBe("admin");
        expect(respostaAlterar.status).toBe(204);
        // 409 = a escrita condicional de removerMembro não encontrou mais o
        // "member" esperado; 403 = Admin1 já leu `alvo` como admin e a
        // própria autorização bloqueou antes de chegar na escrita. Os dois
        // são desfechos seguros — o que não pode acontecer é 204.
        expect([403, 409]).toContain(respostaRemover.status);
      }
    }
  );

  test("REGRESSÃO: duas alterações de role concorrentes no mesmo alvo nunca deixam o membro em estado inconsistente", async () => {
    const dono = await registrarUsuario("racaAlterarDono");
    const alvo = await registrarUsuario("racaAlterarAlvo");
    await adicionarMembro(dono.organizationId, alvo.token, "member");
    const alvoUserId = extrairUserIdDoToken(alvo.token);

    // Duas requisições do próprio owner, concorrentes, tentando papéis
    // diferentes pro mesmo alvo. As duas partem da mesma leitura inicial
    // ("member"), então as duas passam na autorização — mas a escrita
    // condicional (updateRoleSeAtual) só deixa UMA delas vencer de fato: a
    // segunda a rodar encontra a role já alterada pela primeira e não bate
    // mais com o que ela esperava, recebendo 409 em vez de sobrescrever
    // silenciosamente. É exatamente essa serialização que a correção
    // garante — antes, as duas venceriam sempre, e a ordem de chegada ao
    // banco decidiria o resultado final sem nenhum sinal de conflito.
    const [respostaA, respostaB] = await Promise.all([
      request(app)
        .patch(`/organizations/${dono.organizationId}/members/${alvoUserId}`)
        .set("Authorization", `Bearer ${dono.token}`)
        .send({ role: "admin" }),
      request(app)
        .patch(`/organizations/${dono.organizationId}/members/${alvoUserId}`)
        .set("Authorization", `Bearer ${dono.token}`)
        .send({ role: "member" }),
    ]);

    const statuses = [respostaA.status, respostaB.status];
    // Sempre tem que haver pelo menos um vencedor — a primeira a chegar
    // encontra exatamente o estado que leu, então nunca falha por conflito.
    expect(statuses).toContain(204);
    // E nenhuma das duas pode terminar em outra coisa que não 204 (sucesso)
    // ou 409 (perdeu a corrida) — nada de 500 nem de um estado indefinido.
    for (const status of statuses) {
      expect([204, 409]).toContain(status);
    }

    const membroFinal = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: dono.organizationId, userId: alvoUserId } },
    });
    expect(["admin", "member"]).toContain(membroFinal.role);
  });
});