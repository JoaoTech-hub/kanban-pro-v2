const request = require("supertest");
const app = require("../src/app");
const { registrarUsuario, adicionarMembro } = require("./helpers/authHelpers");
const { prisma } = require("./helpers/resetDb");
const organizationRepository = require("../src/repositories/organization.repository");
const projectRepository = require("../src/repositories/project.repository");

describe("Projects", () => {
  describe("Autenticação e autorização", () => {
    test("401 - bloqueia acesso sem token", async () => {
      const { organizationId } = await registrarUsuario("auth1");

      const res = await request(app).get(`/organizations/${organizationId}/projects`);

      expect(res.status).toBe(401);
    });

    test("401 - bloqueia acesso com token inválido", async () => {
      const { organizationId } = await registrarUsuario("auth2");

      const res = await request(app)
        .get(`/organizations/${organizationId}/projects`)
        .set("Authorization", "Bearer token-invalido-qualquer");

      expect(res.status).toBe(401);
    });

    test("403 - bloqueia acesso a organização da qual o usuário não é membro", async () => {
      const usuarioA = await registrarUsuario("isolA");
      const usuarioB = await registrarUsuario("isolB");

      const res = await request(app)
        .get(`/organizations/${usuarioA.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.erro).toBe("Você não pertence a esta organização");
    });

    test("404 - organização informada na URL não existe", async () => {
      const usuario = await registrarUsuario("orgInexistente");
      const idInexistente = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .get(`/organizations/${idInexistente}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(404);
      expect(res.body.erro).toBe("Organização não encontrada");
    });
  });

  describe("CRUD básico", () => {
    test("cria um projeto com sucesso e gera as 3 colunas padrão", async () => {
      const usuario = await registrarUsuario("crud1");

      const res = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto Teste", type: "saas" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Projeto Teste");
      expect(res.body.organizationId).toBe(usuario.organizationId);

      const colunas = await prisma.coluna.findMany({ where: { projectId: res.body.id } });
      expect(colunas).toHaveLength(3);
      expect(colunas.map((c) => c.nome).sort()).toEqual(
        ["A Fazer", "Concluído", "Em Andamento"].sort()
      );
    });

    test("rejeita criação com nome vazio (400)", async () => {
      const usuario = await registrarUsuario("crud2");

      const res = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    test("lista os projetos da organização", async () => {
      const usuario = await registrarUsuario("crud3");

      await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto A" });

      const res = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.dados).toHaveLength(1);
      expect(res.body.dados[0].name).toBe("Projeto A");
    });

    test("busca um projeto específico por id", async () => {
      const usuario = await registrarUsuario("crud4");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto Detalhe" });

      const res = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(criado.body.id);
    });

    test("404 ao buscar projeto inexistente", async () => {
      const usuario = await registrarUsuario("crud5");
      const idInexistente = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${idInexistente}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(404);
    });

    test("remove um projeto com sucesso", async () => {
      const usuario = await registrarUsuario("crud6");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      // Cria um projeto base para garantir que sobrará pelo menos 1
      await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto Base" });

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto a Remover" });

      const remocao = await request(app)
        .delete(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(remocao.status).toBe(204);

      const buscaAposRemocao = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(buscaAposRemocao.status).toBe(404);
    });

    test("404 ao tentar remover projeto inexistente", async () => {
      const usuario = await registrarUsuario("crud7");
      const idInexistente = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .delete(`/organizations/${usuario.organizationId}/projects/${idInexistente}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(404);
    });

    test("duas remoções concorrentes do mesmo projeto: uma retorna 204 e a outra 404 (regressão de condição de corrida)", async () => {
      const usuario = await registrarUsuario("crudRemoverConcorrente");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      // Cria um projeto base para garantir que o total não zere
      await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto Base" });

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto a Remover Concorrente" });

      const [respostaA, respostaB] = await Promise.all([
        request(app)
          .delete(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
          .set("Authorization", `Bearer ${usuario.token}`),
        request(app)
          .delete(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
          .set("Authorization", `Bearer ${usuario.token}`),
      ]);

      const statuses = [respostaA.status, respostaB.status].sort();
      expect(statuses).toEqual([204, 404]);

      const buscaAposRemocao = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(buscaAposRemocao.status).toBe(404);
    });

    test("renomeia um projeto com sucesso", async () => {
      const usuario = await registrarUsuario("crud8");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Nome Antigo" });

      const renomear = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Nome Novo" });

      expect(renomear.status).toBe(204);

      const busca = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(busca.body.name).toBe("Nome Novo");
    });

    test("rejeita renomear com nome vazio (400)", async () => {
      const usuario = await registrarUsuario("crud9");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Nome Original" });

      const res = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    test("404 ao tentar renomear projeto inexistente", async () => {
      const usuario = await registrarUsuario("crud10");
      const idInexistente = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${idInexistente}`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Qualquer Nome" });

      expect(res.status).toBe(404);
    });
  });

  describe("Isolamento entre organizações (IDOR)", () => {
    test("usuário de uma organização não consegue ver projeto de outra organização", async () => {
      const usuarioA = await registrarUsuario("idorA");
      const usuarioB = await registrarUsuario("idorB");

      const projetoDeA = await request(app)
        .post(`/organizations/${usuarioA.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioA.token}`)
        .send({ name: "Projeto Privado de A" });

      const tentativa = await request(app)
        .get(`/organizations/${usuarioB.organizationId}/projects/${projetoDeA.body.id}`)
        .set("Authorization", `Bearer ${usuarioB.token}`);

      expect(tentativa.status).toBe(404);
    });

    test("usuário de uma organização não consegue renomear projeto de outra organização", async () => {
      const usuarioA = await registrarUsuario("idorRenomeioA");
      const usuarioB = await registrarUsuario("idorRenomeioB");

      const projetoDeA = await request(app)
        .post(`/organizations/${usuarioA.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioA.token}`)
        .send({ name: "Projeto Privado de A" });

      const tentativa = await request(app)
        .patch(`/organizations/${usuarioB.organizationId}/projects/${projetoDeA.body.id}`)
        .set("Authorization", `Bearer ${usuarioB.token}`)
        .send({ name: "Nome Hackeado" });

      expect(tentativa.status).toBe(404);
    });

    test("usuário de uma organização não consegue excluir projeto de outra organização", async () => {
      const usuarioA = await registrarUsuario("idorExcluirProjetoA");
      const usuarioB = await registrarUsuario("idorExcluirProjetoB");
      const projetoDeA = await request(app)
        .post(`/organizations/${usuarioA.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioA.token}`)
        .send({ name: "Projeto que deve permanecer" });

      const tentativa = await request(app)
        .delete(`/organizations/${usuarioB.organizationId}/projects/${projetoDeA.body.id}`)
        .set("Authorization", `Bearer ${usuarioB.token}`);

      expect(tentativa.status).toBe(404);
      const projetoPreservado = await request(app)
        .get(`/organizations/${usuarioA.organizationId}/projects/${projetoDeA.body.id}`)
        .set("Authorization", `Bearer ${usuarioA.token}`);
      expect(projetoPreservado.status).toBe(200);
      expect(projetoPreservado.body.name).toBe("Projeto que deve permanecer");
    });
  });

    describe("Fundo do quadro (background)", () => {
    test("atualiza o fundo do quadro com uma chave válida", async () => {
      const usuario = await registrarUsuario("bg1");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro com fundo" });

      const atualizar = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}/background`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ background: "oceano" });

      expect(atualizar.status).toBe(204);

      const busca = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(busca.body.background).toBe("oceano");
    });

    test("aceita `null` para voltar ao fundo padrão", async () => {
      const usuario = await registrarUsuario("bg2");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro" });

      await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}/background`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ background: "vinho" });

      const resetar = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}/background`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ background: null });

      expect(resetar.status).toBe(204);

      const busca = await request(app)
        .get(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(busca.body.background).toBeNull();
    });

    test("rejeita chave de fundo fora da lista permitida (400)", async () => {
      const usuario = await registrarUsuario("bg3");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro" });

      const res = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}/background`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ background: "url(javascript:alert(1))" });

      expect(res.status).toBe(400);
    });

    test("rejeita omitir o campo background (400) — precisa mandar null explicitamente pra resetar", async () => {
      const usuario = await registrarUsuario("bg4");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro" });

      const res = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${criado.body.id}/background`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("404 ao tentar alterar fundo de projeto inexistente", async () => {
      const usuario = await registrarUsuario("bg5");
      const idInexistente = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .patch(`/organizations/${usuario.organizationId}/projects/${idInexistente}/background`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ background: "ceu" });

      expect(res.status).toBe(404);
    });

    test("usuário de uma organização não consegue alterar o fundo de projeto de outra organização (IDOR)", async () => {
      const usuarioA = await registrarUsuario("bgIdorA");
      const usuarioB = await registrarUsuario("bgIdorB");

      const projetoDeA = await request(app)
        .post(`/organizations/${usuarioA.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioA.token}`)
        .send({ name: "Projeto Privado de A" });

      const tentativa = await request(app)
        .patch(`/organizations/${usuarioB.organizationId}/projects/${projetoDeA.body.id}/background`)
        .set("Authorization", `Bearer ${usuarioB.token}`)
        .send({ background: "vinho" });

      expect(tentativa.status).toBe(404);

      // Confirma que o fundo do projeto de A não foi alterado pela tentativa.
      const busca = await request(app)
        .get(`/organizations/${usuarioA.organizationId}/projects/${projetoDeA.body.id}`)
        .set("Authorization", `Bearer ${usuarioA.token}`);

      expect(busca.body.background).toBeNull();
    });

    test("member (não apenas owner/admin) consegue alterar o fundo do quadro — diferente de renomear, é uma ação cosmética liberada a qualquer membro", async () => {
      const owner = await registrarUsuario("bgRoleOwner");
      const membro = await registrarUsuario("bgRoleMember");
      await adicionarMembro(owner.organizationId, membro.token, "member");

      const criado = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Quadro do Owner" });

      const res = await request(app)
        .patch(`/organizations/${owner.organizationId}/projects/${criado.body.id}/background`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ background: "floresta" });

      expect(res.status).toBe(204);
    });
  });

  describe("Regras de plano", () => {
    test("plano Free permite criar até 10 projetos, e bloqueia o 11º (403)", async () => {
      const usuario = await registrarUsuario("planFree");

      for (let i = 1; i <= 10; i++) {
        const resposta = await request(app)
          .post(`/organizations/${usuario.organizationId}/projects`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ name: `Projeto ${i}` });
        expect(resposta.status).toBe(201);
      }

      const totalAntes = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(totalAntes).toBe(10);

      const decimoPrimeiro = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Projeto 11" });

      expect(decimoPrimeiro.status).toBe(403);
      expect(decimoPrimeiro.body.erro).toMatch(/limite/i);
      expect(decimoPrimeiro.body.erro).toMatch(/10 projetos/);

      const totalDepois = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(totalDepois).toBe(10);
    });

    test("duas criações concorrentes com só 1 vaga restante no plano Free: só uma pode passar (regressão de condição de corrida)", async () => {
      const usuario = await registrarUsuario("planFreeConcorrente");

      // 9 projetos seedados direto no banco (sem passar pela regra, só pra
      // montar o cenário mais rápido) = 1 vaga livre antes do teto de 10.
      for (let i = 0; i < 9; i++) {
        await projectRepository.create({
          organizationId: usuario.organizationId,
          name: `Seed ${i}`,
          type: "saas",
        });
      }
      const totalAntes = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(totalAntes).toBe(9);

      const [respostaA, respostaB] = await Promise.all([
        request(app)
          .post(`/organizations/${usuario.organizationId}/projects`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ name: "Projeto Concorrente A" }),
        request(app)
          .post(`/organizations/${usuario.organizationId}/projects`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ name: "Projeto Concorrente B" }),
      ]);

      const statuses = [respostaA.status, respostaB.status].sort();
      expect(statuses).toEqual([201, 403]);

      const vencedora = respostaA.status === 201 ? respostaA : respostaB;
      const rejeitada = respostaA.status === 201 ? respostaB : respostaA;
      expect(rejeitada.body.erro).toMatch(/limite/i);

      const total = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(total).toBe(10);
      expect(vencedora.status).toBe(201);
    });

    test("plano Pro não fica preso ao teto do Free — cria além de 10 projetos normalmente", async () => {
      const usuario = await registrarUsuario("planPro");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      for (let i = 1; i <= 11; i++) {
        const resposta = await request(app)
          .post(`/organizations/${usuario.organizationId}/projects`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ name: `Projeto Pro ${i}` });
        expect(resposta.status).toBe(201);
      }

      const total = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(total).toBe(11);
    });

    test("o limite é isolado por organização — organização A no teto não afeta a criação na organização B", async () => {
      const usuarioA = await registrarUsuario("planFreeIsoladoA");
      const usuarioB = await registrarUsuario("planFreeIsoladoB");

      // Leva a organização A até o teto (10), direto no banco por rapidez.
      for (let i = 0; i < 10; i++) {
        await projectRepository.create({
          organizationId: usuarioA.organizationId,
          name: `Seed A ${i}`,
          type: "saas",
        });
      }
      const totalA = await prisma.project.count({
        where: { organizationId: usuarioA.organizationId },
      });
      expect(totalA).toBe(10);

      const tentativaA = await request(app)
        .post(`/organizations/${usuarioA.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioA.token}`)
        .send({ name: "Projeto 11 de A" });
      expect(tentativaA.status).toBe(403);

      // B está zerada (nenhum projeto ainda) e não é afetada pelo teto de
      // A — consegue criar normalmente, bem abaixo do limite dela.
      const criacaoB = await request(app)
        .post(`/organizations/${usuarioB.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuarioB.token}`)
        .send({ name: "Primeiro Projeto de B" });
      expect(criacaoB.status).toBe(201);

      const totalB = await prisma.project.count({
        where: { organizationId: usuarioB.organizationId },
      });
      expect(totalB).toBe(1);
    });
  });

  describe("Regra: nunca excluir o último quadro da organização", () => {
    test("plano Free: bloqueia excluir o único quadro existente (409)", async () => {
      const usuario = await registrarUsuario("semUltimoFree");

      const criado = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Único Quadro" });

      const res = await request(app)
        .delete(`/organizations/${usuario.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(409);
      expect(res.body.erro).toMatch(/último quadro/i);

      const total = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(total).toBe(1);
    });

    test("plano Pro: permite excluir um quadro desde que sobre pelo menos outro", async () => {
      const usuario = await registrarUsuario("semUltimoProA");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      const primeiro = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro 1" });
      const segundo = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro 2" });

      const res = await request(app)
        .delete(`/organizations/${usuario.organizationId}/projects/${primeiro.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(204);

      const total = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(total).toBe(1);

      const restante = await prisma.project.findFirst({
        where: { organizationId: usuario.organizationId },
      });
      expect(restante.id).toBe(segundo.body.id);
    });

    test("plano Pro: depois de excluir até sobrar 1, esse último também fica bloqueado", async () => {
      const usuario = await registrarUsuario("semUltimoProB");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      const primeiro = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro 1" });
      const segundo = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro 2" });

      const primeiraExclusao = await request(app)
        .delete(`/organizations/${usuario.organizationId}/projects/${primeiro.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);
      expect(primeiraExclusao.status).toBe(204);

      const segundaExclusao = await request(app)
        .delete(`/organizations/${usuario.organizationId}/projects/${segundo.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(segundaExclusao.status).toBe(409);
    });

    test("duas exclusões concorrentes com só 2 quadros restando: só uma pode passar (regressão de condição de corrida)", async () => {
      const usuario = await registrarUsuario("semUltimoConcorrente");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      const quadroA = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro A" });
      const quadroB = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Quadro B" });

      const [respostaA, respostaB] = await Promise.all([
        request(app)
          .delete(`/organizations/${usuario.organizationId}/projects/${quadroA.body.id}`)
          .set("Authorization", `Bearer ${usuario.token}`),
        request(app)
          .delete(`/organizations/${usuario.organizationId}/projects/${quadroB.body.id}`)
          .set("Authorization", `Bearer ${usuario.token}`),
      ]);

      const statuses = [respostaA.status, respostaB.status].sort();
      expect(statuses).toEqual([204, 409]);

      const total = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(total).toBe(1);
    });
  });

  describe("Autorização por papel (role)", () => {
    test("member não pode criar projeto (403)", async () => {
      const owner = await registrarUsuario("roleOwner1");
      const membro = await registrarUsuario("roleMember1");
      await adicionarMembro(owner.organizationId, membro.token, "member");

      const res = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ name: "Projeto do Member" });

      expect(res.status).toBe(403);
    });

    test("member não pode excluir projeto (403)", async () => {
      const owner = await registrarUsuario("roleOwner2");
      const membro = await registrarUsuario("roleMember2");
      await adicionarMembro(owner.organizationId, membro.token, "member");

      const criado = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Projeto do Owner" });

      const res = await request(app)
        .delete(`/organizations/${owner.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${membro.token}`);

      expect(res.status).toBe(403);
    });

    test("member pode listar e visualizar projetos (somente leitura permitida)", async () => {
      const owner = await registrarUsuario("roleOwner3");
      const membro = await registrarUsuario("roleMember3");
      await adicionarMembro(owner.organizationId, membro.token, "member");

      const criado = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Projeto Visível" });

      const res = await request(app)
        .get(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${membro.token}`);

      expect(res.status).toBe(200);
      expect(res.body.dados.some((p) => p.id === criado.body.id)).toBe(true);
    });

    test("admin (não apenas owner) pode criar e excluir projeto", async () => {
      const owner = await registrarUsuario("roleOwner4");
      const admin = await registrarUsuario("roleAdmin1");
      await adicionarMembro(owner.organizationId, admin.token, "admin");
      await organizationRepository.updatePlan(owner.organizationId, "pro");

      // Cria um projeto base para garantir que sobrará 1 quando o admin excluir o dele
      await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Projeto Base" });

      const criar = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "Projeto do Admin" });

      expect(criar.status).toBe(201);

      const excluir = await request(app)
        .delete(`/organizations/${owner.organizationId}/projects/${criar.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`);

      expect(excluir.status).toBe(204);
    });

    test("member não pode renomear projeto (403)", async () => {
      const owner = await registrarUsuario("roleOwner5");
      const membro = await registrarUsuario("roleMember4");
      await adicionarMembro(owner.organizationId, membro.token, "member");

      const criado = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Projeto do Owner" });

      const res = await request(app)
        .patch(`/organizations/${owner.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ name: "Nome Tentado pelo Member" });

      expect(res.status).toBe(403);
    });

    test("admin (não apenas owner) pode renomear projeto", async () => {
      const owner = await registrarUsuario("roleOwner6");
      const admin = await registrarUsuario("roleAdmin2");
      await adicionarMembro(owner.organizationId, admin.token, "admin");

      const criado = await request(app)
        .post(`/organizations/${owner.organizationId}/projects`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Nome Original" });

      const res = await request(app)
        .patch(`/organizations/${owner.organizationId}/projects/${criado.body.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ name: "Nome Alterado pelo Admin" });

      expect(res.status).toBe(204);
    });
  });
});
