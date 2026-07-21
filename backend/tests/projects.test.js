const request = require("supertest");
const app = require("../src/app");
const { registrarUsuario, adicionarMembro } = require("./helpers/authHelpers");
const { prisma } = require("./helpers/resetDb");
const organizationRepository = require("../src/repositories/organization.repository");

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

      // Nota: usa a organizationId de B na URL — a mesma defesa que já
      // protege GET/DELETE (filtrar sempre por id + organizationId) também
      // vale aqui, então isso precisa dar 404, não 403 nem 204.
      const tentativa = await request(app)
        .patch(`/organizations/${usuarioB.organizationId}/projects/${projetoDeA.body.id}`)
        .set("Authorization", `Bearer ${usuarioB.token}`)
        .send({ name: "Nome Hackeado" });

      expect(tentativa.status).toBe(404);
    });
  });

  describe("Regras de plano", () => {
    test("plano Free bloqueia criação do 2º projeto (403)", async () => {
      const usuario = await registrarUsuario("planFree");

      const primeiro = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Primeiro Projeto" });

      expect(primeiro.status).toBe(201);

      const segundo = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Segundo Projeto" });

      expect(segundo.status).toBe(403);
      expect(segundo.body.erro).toMatch(/plano gratuito/i);
    });

    test("duas criações concorrentes no plano Free: só uma pode passar (regressão de condição de corrida)", async () => {
      const usuario = await registrarUsuario("planFreeConcorrente");

      // Dispara as duas criações "ao mesmo tempo" (sem esperar uma terminar
      // antes de iniciar a outra) — é o cenário que travar a linha da
      // organização (organizationRepository.lockForUpdate) precisa cobrir,
      // e que a checagem antiga (contar fora da transação) não cobria.
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
      // Exatamente uma das duas deve ter sido aceita (201) e a outra
      // rejeitada pelo limite do plano (403) — nunca as duas com sucesso.
      expect(statuses).toEqual([201, 403]);

      const vencedora = respostaA.status === 201 ? respostaA : respostaB;
      const rejeitada = respostaA.status === 201 ? respostaB : respostaA;
      expect(rejeitada.body.erro).toMatch(/plano gratuito/i);

      // Confere no banco que realmente sobrou só 1 projeto — não basta a
      // resposta HTTP estar certa, o dado persistido precisa bater também.
      const total = await prisma.project.count({
        where: { organizationId: usuario.organizationId },
      });
      expect(total).toBe(1);
      expect(vencedora.status).toBe(201);
    });

    test("plano Pro permite criar mais de 1 projeto", async () => {
      const usuario = await registrarUsuario("planPro");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");

      const primeiro = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Primeiro Projeto Pro" });

      const segundo = await request(app)
        .post(`/organizations/${usuario.organizationId}/projects`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ name: "Segundo Projeto Pro" });

      expect(primeiro.status).toBe(201);
      expect(segundo.status).toBe(201);
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