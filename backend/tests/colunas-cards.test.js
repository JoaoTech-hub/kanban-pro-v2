const request = require("supertest");
const app = require("../src/app");
const { registrarUsuario } = require("./helpers/authHelpers");

async function criarProjeto(token, organizationId, nome = "Projeto Teste") {
  const res = await request(app)
    .post(`/organizations/${organizationId}/projects`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: nome });
  return res.body;
}

function base(organizationId, projectId) {
  return `/organizations/${organizationId}/projects/${projectId}`;
}

describe("Colunas e Cards", () => {
  describe("Colunas", () => {
    test("lista as 3 colunas padrão criadas junto com o projeto", async () => {
      const usuario = await registrarUsuario("colA");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);

      const res = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    test("cria uma coluna nova", async () => {
      const usuario = await registrarUsuario("colB");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);

      const res = await request(app)
        .post(`${base(usuario.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ nome: "Revisão" });

      expect(res.status).toBe(201);
      expect(res.body.nome).toBe("Revisão");
      expect(res.body.ordem).toBe(3); // depois das 3 padrão
    });

    test("401 sem token", async () => {
      const usuario = await registrarUsuario("colC");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);

      const res = await request(app).get(`${base(usuario.organizationId, projeto.id)}/colunas`);
      expect(res.status).toBe(401);
    });

    test("404 ao listar colunas de um projeto que não pertence à organização", async () => {
      const usuarioA = await registrarUsuario("projInexistenteA");
      const usuarioB = await registrarUsuario("projInexistenteB");
      const projetoB = await criarProjeto(usuarioB.token, usuarioB.organizationId);

      // A tenta listar colunas usando a PRÓPRIA organização na URL,
      // mas o projectId de B — não deve encontrar nada além de 404.
      const res = await request(app)
        .get(`${base(usuarioA.organizationId, projetoB.id)}/colunas`)
        .set("Authorization", `Bearer ${usuarioA.token}`);

      expect(res.status).toBe(404);
    });

    test("member não pode criar coluna (403)", async () => {
      const owner = await registrarUsuario("colRoleOwner1");
      const membro = await registrarUsuario("colRoleMember1");
      const organizationMemberRepository = require("../src/repositories/organizationMember.repository");
      const jwt = require("jsonwebtoken");
      const membroId = jwt.decode(membro.token).id;
      await organizationMemberRepository.create({
        organizationId: owner.organizationId,
        userId: membroId,
        role: "member",
      });
      const projeto = await criarProjeto(owner.token, owner.organizationId);

      const res = await request(app)
        .post(`${base(owner.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ nome: "Coluna do member" });

      expect(res.status).toBe(403);
    });

    test("duas criações concorrentes de coluna no mesmo projeto não geram 'ordem' duplicada (regressão de concorrência)", async () => {
      const usuario = await registrarUsuario("colConcorrente");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);

      // Dispara as duas criações "ao mesmo tempo" — é o cenário que a
      // trava de linha no projeto (usada dentro de coluna.repository.js
      // antes de calcular MAX(ordem)+1) precisa cobrir, sem depender de as
      // chamadas serem sequenciais.
      const [respostaA, respostaB] = await Promise.all([
        request(app)
          .post(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ nome: "Coluna Concorrente A" }),
        request(app)
          .post(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ nome: "Coluna Concorrente B" }),
      ]);

      expect(respostaA.status).toBe(201);
      expect(respostaB.status).toBe(201);
      // As 3 colunas padrão já ocupam posições — as duas novas precisam
      // ficar em posições diferentes uma da outra.
      expect(respostaA.body.ordem).not.toBe(respostaB.body.ordem);

      const todas = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);

      const ordens = todas.body.map((c) => c.ordem);
      const ordensUnicas = new Set(ordens);
      expect(ordensUnicas.size).toBe(ordens.length);
    });
  });

  describe("Cards", () => {
    test("cria e lista um card na coluna correta", async () => {
      const usuario = await registrarUsuario("cardA");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);
      const colunas = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);
      const colunaId = colunas.body[0].id;

      const criar = await request(app)
        .post(`${base(usuario.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ titulo: "Minha tarefa", colunaId });

      expect(criar.status).toBe(201);

      const listar = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${usuario.token}`);

      expect(listar.status).toBe(200);
      expect(listar.body.some((c) => c.titulo === "Minha tarefa")).toBe(true);
    });

    test("rejeita criação de card com prioridade inválida", async () => {
      const usuario = await registrarUsuario("cardB");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);
      const colunas = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);

      const res = await request(app)
        .post(`${base(usuario.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ titulo: "Card X", colunaId: colunas.body[0].id, prioridade: "urgentissimo" });

      expect(res.status).toBe(400);
    });

    test("404 ao criar card com colunaId de outro projeto", async () => {
      const usuario = await registrarUsuario("cardC");
      const projetoA = await criarProjeto(usuario.token, usuario.organizationId, "Projeto A");

      // plano free só permite 1 projeto — upgrade pra pro pra criar um segundo projeto de teste
      const organizationRepository = require("../src/repositories/organization.repository");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");
      const projetoB = await criarProjeto(usuario.token, usuario.organizationId, "Projeto B");

      const colunasDeB = await request(app)
        .get(`${base(usuario.organizationId, projetoB.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);

      // tenta criar card no Projeto A usando uma coluna que pertence ao Projeto B
      const tentativa = await request(app)
        .post(`${base(usuario.organizationId, projetoA.id)}/cards`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ titulo: "Card cruzado", colunaId: colunasDeB.body[0].id });

      expect(tentativa.status).toBe(404);
    });

    test("REGRESSÃO (IDOR): usuário B não consegue apagar coluna do projeto de A", async () => {
      const usuarioA = await registrarUsuario("idorCardA");
      const usuarioB = await registrarUsuario("idorCardB");
      const projetoA = await criarProjeto(usuarioA.token, usuarioA.organizationId);

      const colunasDeA = await request(app)
        .get(`${base(usuarioA.organizationId, projetoA.id)}/colunas`)
        .set("Authorization", `Bearer ${usuarioA.token}`);

      // B tenta apagar a coluna de A informando a própria organização/projeto na URL
      const tentativa = await request(app)
        .delete(`${base(usuarioB.organizationId, projetoA.id)}/colunas/${colunasDeA.body[0].id}`)
        .set("Authorization", `Bearer ${usuarioB.token}`);

      expect(tentativa.status).toBe(404); // bloqueado no requireProject: o projeto não pertence à organização de B
    });

    test("404 ao mover/editar card informando projectId diferente do dono real do card", async () => {
      const usuario = await registrarUsuario("cardScopeA");
      const projetoA = await criarProjeto(usuario.token, usuario.organizationId, "Projeto A");

      const organizationRepository = require("../src/repositories/organization.repository");
      await organizationRepository.updatePlan(usuario.organizationId, "pro");
      const projetoB = await criarProjeto(usuario.token, usuario.organizationId, "Projeto B");

      const colunasA = await request(app)
        .get(`${base(usuario.organizationId, projetoA.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);

      const cardA = await request(app)
        .post(`${base(usuario.organizationId, projetoA.id)}/cards`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ titulo: "Card de A", colunaId: colunasA.body[0].id });

      const colunasB = await request(app)
        .get(`${base(usuario.organizationId, projetoB.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);

      // Tenta editar o card de A usando a URL do Projeto B — mesmo que o
      // colunaId de destino seja de B, o card em si pertence a A: deve 404.
      const tentativa = await request(app)
        .patch(`${base(usuario.organizationId, projetoB.id)}/cards/${cardA.body.id}`)
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ titulo: "Editado", colunaId: colunasB.body[0].id });

      expect(tentativa.status).toBe(404);
    });

    test("member PODE mover card de coluna (200/204)", async () => {
      const owner = await registrarUsuario("cardMoveOwner");
      const membro = await registrarUsuario("cardMoveMember");
      const organizationMemberRepository = require("../src/repositories/organizationMember.repository");
      const jwt = require("jsonwebtoken");

      const membroId = jwt.decode(membro.token).id;
      await organizationMemberRepository.create({
        organizationId: owner.organizationId,
        userId: membroId,
        role: "member",
      });

      const projeto = await criarProjeto(owner.token, owner.organizationId);
      const colunas = await request(app)
        .get(`${base(owner.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${owner.token}`);

      // Owner cria o card
      const card = await request(app)
        .post(`${base(owner.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ titulo: "Card para Mover", colunaId: colunas.body[0].id });

      // Member tenta mover para a segunda coluna
      const res = await request(app)
        .patch(`${base(owner.organizationId, projeto.id)}/cards/${card.body.id}/mover`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ colunaId: colunas.body[1].id, ordem: 0 });

      expect([200, 204]).toContain(res.status);
    });

    test("member NÃO pode criar card (403)", async () => {
      const owner = await registrarUsuario("cardRoleOwner1");
      const membro = await registrarUsuario("cardRoleMember1");
      const organizationMemberRepository = require("../src/repositories/organizationMember.repository");
      const jwt = require("jsonwebtoken");

      const membroId = jwt.decode(membro.token).id;
      await organizationMemberRepository.create({
        organizationId: owner.organizationId,
        userId: membroId,
        role: "member",
      });

      const projeto = await criarProjeto(owner.token, owner.organizationId);
      const colunas = await request(app)
        .get(`${base(owner.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${owner.token}`);

      const res = await request(app)
        .post(`${base(owner.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ titulo: "Card Proibido", colunaId: colunas.body[0].id });

      expect(res.status).toBe(403);
    });

    test("member NÃO pode editar detalhes do card (403)", async () => {
      const owner = await registrarUsuario("cardRoleOwner2");
      const membro = await registrarUsuario("cardRoleMember2");
      const organizationMemberRepository = require("../src/repositories/organizationMember.repository");
      const jwt = require("jsonwebtoken");

      const membroId = jwt.decode(membro.token).id;
      await organizationMemberRepository.create({
        organizationId: owner.organizationId,
        userId: membroId,
        role: "member",
      });

      const projeto = await criarProjeto(owner.token, owner.organizationId);
      const colunas = await request(app)
        .get(`${base(owner.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${owner.token}`);

      const card = await request(app)
        .post(`${base(owner.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ titulo: "Original", colunaId: colunas.body[0].id });

      const res = await request(app)
        .patch(`${base(owner.organizationId, projeto.id)}/cards/${card.body.id}`)
        .set("Authorization", `Bearer ${membro.token}`)
        .send({ titulo: "Tentativa de Alteração", colunaId: colunas.body[0].id });

      expect(res.status).toBe(403);
    });

    test("member NÃO pode excluir card (403)", async () => {
      const owner = await registrarUsuario("cardRoleOwner3");
      const membro = await registrarUsuario("cardRoleMember3");
      const organizationMemberRepository = require("../src/repositories/organizationMember.repository");
      const jwt = require("jsonwebtoken");

      const membroId = jwt.decode(membro.token).id;
      await organizationMemberRepository.create({
        organizationId: owner.organizationId,
        userId: membroId,
        role: "member",
      });

      const projeto = await criarProjeto(owner.token, owner.organizationId);
      const colunas = await request(app)
        .get(`${base(owner.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${owner.token}`);

      const card = await request(app)
        .post(`${base(owner.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ titulo: "Para deletar", colunaId: colunas.body[0].id });

      const res = await request(app)
        .delete(`${base(owner.organizationId, projeto.id)}/cards/${card.body.id}`)
        .set("Authorization", `Bearer ${membro.token}`);

      expect(res.status).toBe(403);
    });

    test("duas criações concorrentes de card na mesma coluna não geram 'ordem' duplicada (regressão de concorrência)", async () => {
      const usuario = await registrarUsuario("cardConcorrente");
      const projeto = await criarProjeto(usuario.token, usuario.organizationId);
      const colunas = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
        .set("Authorization", `Bearer ${usuario.token}`);
      const colunaId = colunas.body[0].id;

      // Dispara as duas criações "ao mesmo tempo" — é o cenário que a
      // trava de linha na coluna (usada dentro de card.repository.js antes
      // de calcular MAX(ordem)+1) precisa cobrir.
      const [respostaA, respostaB] = await Promise.all([
        request(app)
          .post(`${base(usuario.organizationId, projeto.id)}/cards`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ titulo: "Card Concorrente A", colunaId }),
        request(app)
          .post(`${base(usuario.organizationId, projeto.id)}/cards`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ titulo: "Card Concorrente B", colunaId }),
      ]);

      expect(respostaA.status).toBe(201);
      expect(respostaB.status).toBe(201);
      expect(respostaA.body.ordem).not.toBe(respostaB.body.ordem);

      const todos = await request(app)
        .get(`${base(usuario.organizationId, projeto.id)}/cards`)
        .set("Authorization", `Bearer ${usuario.token}`);

      const daColuna = todos.body.filter((c) => c.colunaId === colunaId);
      const ordens = daColuna.map((c) => c.ordem);
      const ordensUnicas = new Set(ordens);
      expect(ordensUnicas.size).toBe(ordens.length);
    });
  });
});