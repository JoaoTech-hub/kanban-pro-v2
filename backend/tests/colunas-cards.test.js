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

    describe("mover() — recálculo de ordem", () => {
      // Helper: cria N cards em sequência (ordem 0..n-1) numa coluna e
      // devolve os cards já criados, na ordem em que foram criados.
      async function criarCards(token, organizationId, projectId, colunaId, titulos) {
        const cards = [];
        for (const titulo of titulos) {
          const res = await request(app)
            .post(`${base(organizationId, projectId)}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ titulo, colunaId });
          cards.push(res.body);
        }
        return cards;
      }

      async function listarPorColuna(token, organizationId, projectId, colunaId) {
        const res = await request(app)
          .get(`${base(organizationId, projectId)}/cards`)
          .set("Authorization", `Bearer ${token}`);
        return res.body
          .filter((c) => c.colunaId === colunaId)
          .sort((a, b) => a.ordem - b.ordem);
      }

      function assertOrdemDensaSemBuracos(cards) {
        const ordens = cards.map((c) => c.ordem);
        expect(ordens).toEqual(cards.map((_, i) => i));
        expect(new Set(ordens).size).toBe(ordens.length);
      }

      test("mover dentro da mesma coluna para o início desloca os demais corretamente", async () => {
        const usuario = await registrarUsuario("moverInicio");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const colunaId = colunas.body[0].id;

        const [a, b, c, d] = await criarCards(
          usuario.token, usuario.organizationId, projeto.id, colunaId,
          ["A", "B", "C", "D"]
        );

        // Move D (ordem 3) para o início (ordem 0)
        const res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${d.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId, ordem: 0 });
        expect([200, 204]).toContain(res.status);

        const lista = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, colunaId);
        expect(lista.map((c) => c.id)).toEqual([d.id, a.id, b.id, c.id]);
        assertOrdemDensaSemBuracos(lista);
      });

      test("mover dentro da mesma coluna para o meio desloca os demais corretamente (D -> posição 1)", async () => {
        const usuario = await registrarUsuario("moverMeio");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const colunaId = colunas.body[0].id;

        const [a, b, c, d] = await criarCards(
          usuario.token, usuario.organizationId, projeto.id, colunaId,
          ["A", "B", "C", "D"]
        );

        const res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${d.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId, ordem: 1 });
        expect([200, 204]).toContain(res.status);

        const lista = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, colunaId);
        // Exemplo do enunciado: A, D, B, C
        expect(lista.map((c) => c.id)).toEqual([a.id, d.id, b.id, c.id]);
        assertOrdemDensaSemBuracos(lista);
      });

      test("mover dentro da mesma coluna para o final desloca os demais corretamente", async () => {
        const usuario = await registrarUsuario("moverFinal");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const colunaId = colunas.body[0].id;

        const [a, b, c] = await criarCards(
          usuario.token, usuario.organizationId, projeto.id, colunaId,
          ["A", "B", "C"]
        );

        // Move A (ordem 0) para o final — inclusive testando clamp com um
        // valor de ordem maior que o tamanho da lista.
        const res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${a.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId, ordem: 999 });
        expect([200, 204]).toContain(res.status);

        const lista = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, colunaId);
        expect(lista.map((c) => c.id)).toEqual([b.id, c.id, a.id]);
        assertOrdemDensaSemBuracos(lista);
      });

      test("mover para a mesma posição não corrompe a ordem nem faz trabalho desnecessário", async () => {
        const usuario = await registrarUsuario("moverMesmaPos");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const colunaId = colunas.body[0].id;

        const [a, b, c] = await criarCards(
          usuario.token, usuario.organizationId, projeto.id, colunaId,
          ["A", "B", "C"]
        );

        const res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${b.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId, ordem: 1 });
        expect([200, 204]).toContain(res.status);

        const lista = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, colunaId);
        expect(lista.map((c) => c.id)).toEqual([a.id, b.id, c.id]);
        assertOrdemDensaSemBuracos(lista);
      });

      test("mover para outra coluna reorganiza origem e destino (início, meio e final)", async () => {
        const usuario = await registrarUsuario("moverEntreColunas");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const origemId = colunas.body[0].id;
        const destinoId = colunas.body[1].id;

        const [a, b, c, d] = await criarCards(
          usuario.token, usuario.organizationId, projeto.id, origemId,
          ["A", "B", "C", "D"]
        );
        const [x, y, z] = await criarCards(
          usuario.token, usuario.organizationId, projeto.id, destinoId,
          ["X", "Y", "Z"]
        );

        // Meio da destino (exemplo do enunciado: B -> posição 1 de destino)
        let res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${b.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId: destinoId, ordem: 1 });
        expect([200, 204]).toContain(res.status);

        let listaOrigem = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, origemId);
        let listaDestino = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, destinoId);
        expect(listaOrigem.map((c) => c.id)).toEqual([a.id, c.id, d.id]);
        expect(listaDestino.map((c) => c.id)).toEqual([x.id, b.id, y.id, z.id]);
        assertOrdemDensaSemBuracos(listaOrigem);
        assertOrdemDensaSemBuracos(listaDestino);

        // Início da destino
        res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${a.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId: destinoId, ordem: 0 });
        expect([200, 204]).toContain(res.status);

        listaOrigem = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, origemId);
        listaDestino = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, destinoId);
        expect(listaOrigem.map((c) => c.id)).toEqual([c.id, d.id]);
        expect(listaDestino.map((c) => c.id)).toEqual([a.id, x.id, b.id, y.id, z.id]);
        assertOrdemDensaSemBuracos(listaOrigem);
        assertOrdemDensaSemBuracos(listaDestino);

        // Final da destino (clamp)
        res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${c.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId: destinoId, ordem: 999 });
        expect([200, 204]).toContain(res.status);

        listaOrigem = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, origemId);
        listaDestino = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, destinoId);
        expect(listaOrigem.map((c) => c.id)).toEqual([d.id]);
        expect(listaDestino.map((c) => c.id)).toEqual([a.id, x.id, b.id, y.id, z.id, c.id]);
        assertOrdemDensaSemBuracos(listaOrigem);
        assertOrdemDensaSemBuracos(listaDestino);
      }, 60000); // 3 movimentações sequenciais nesse teste — mais round-trips que os demais

      test("mover o único card de uma coluna para outra esvazia a origem sem buracos", async () => {
        const usuario = await registrarUsuario("moverEsvazia");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const origemId = colunas.body[0].id;
        const destinoId = colunas.body[1].id;

        const [a] = await criarCards(usuario.token, usuario.organizationId, projeto.id, origemId, ["A"]);
        const [x] = await criarCards(usuario.token, usuario.organizationId, projeto.id, destinoId, ["X"]);

        const res = await request(app)
          .patch(`${base(usuario.organizationId, projeto.id)}/cards/${a.id}/mover`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .send({ colunaId: destinoId, ordem: 0 });
        expect([200, 204]).toContain(res.status);

        const listaOrigem = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, origemId);
        const listaDestino = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, destinoId);
        expect(listaOrigem).toHaveLength(0);
        expect(listaDestino.map((c) => c.id)).toEqual([a.id, x.id]);
      });

      test("REGRESSÃO CRÍTICA: duas movimentações concorrentes para a mesma coluna não geram 'ordem' duplicada", async () => {
        const usuario = await registrarUsuario("moverConcorrente");
        const projeto = await criarProjeto(usuario.token, usuario.organizationId);
        const colunas = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`);
        const origemId = colunas.body[0].id;
        const destinoId = colunas.body[1].id;

        // Dois cards em colunas diferentes, movidos "ao mesmo tempo" para a
        // posição 0 da MESMA coluna de destino — antes da correção, nada
        // impedia as duas movimentações de calcular a mesma 'ordem' (0) sem
        // enxergar uma à outra.
        const [a] = await criarCards(usuario.token, usuario.organizationId, projeto.id, origemId, ["A"]);
        const [x] = await criarCards(usuario.token, usuario.organizationId, projeto.id, destinoId, ["X"]);
        const [outraOrigem] = await request(app)
          .get(`${base(usuario.organizationId, projeto.id)}/colunas`)
          .set("Authorization", `Bearer ${usuario.token}`)
          .then((r) => [r.body[2].id]);
        const [b] = await criarCards(usuario.token, usuario.organizationId, projeto.id, outraOrigem, ["B"]);

        const [resA, resB] = await Promise.all([
          request(app)
            .patch(`${base(usuario.organizationId, projeto.id)}/cards/${a.id}/mover`)
            .set("Authorization", `Bearer ${usuario.token}`)
            .send({ colunaId: destinoId, ordem: 0 }),
          request(app)
            .patch(`${base(usuario.organizationId, projeto.id)}/cards/${b.id}/mover`)
            .set("Authorization", `Bearer ${usuario.token}`)
            .send({ colunaId: destinoId, ordem: 0 }),
        ]);

        expect([200, 204]).toContain(resA.status);
        expect([200, 204]).toContain(resB.status);

        const listaDestino = await listarPorColuna(usuario.token, usuario.organizationId, projeto.id, destinoId);
        assertOrdemDensaSemBuracos(listaDestino);
        // Os 3 cards (X original + A + B) precisam estar todos lá, únicos.
        expect(listaDestino.map((c) => c.id).sort()).toEqual([a.id, b.id, x.id].sort());
      });
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