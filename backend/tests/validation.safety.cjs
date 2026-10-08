const express = require("express");
const request = require("supertest");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validar,
  registroSchema,
  projectSchema,
  cardSchema,
  moverCardSchema,
} = require("../src/validators/schemas");

function appComValidacao(schema, aoPassar) {
  const app = express();
  app.use(express.json());
  app.post("/entrada", validar(schema), aoPassar);
  return app;
}

test("payload obrigatório ausente ou com tipos incorretos não chega ao handler", async () => {
  let chamadasHandler = 0;
  const app = appComValidacao(registroSchema, (_req, res) => {
    chamadasHandler += 1;
    res.sendStatus(204);
  });

  const resposta = await request(app).post("/entrada").send({ nome: 123, email: [], senha: null });

  assert.equal(resposta.status, 400);
  assert.equal(chamadasHandler, 0);
});

test("strings acima do limite do schema de projeto são rejeitadas antes do handler", async () => {
  let chamadasHandler = 0;
  const app = appComValidacao(projectSchema, (_req, res) => {
    chamadasHandler += 1;
    res.sendStatus(204);
  });

  const resposta = await request(app).post("/entrada").send({ name: "p".repeat(121) });

  assert.equal(resposta.status, 400);
  assert.equal(chamadasHandler, 0);
});

test("UUID inválido e enum não permitido no card são rejeitados antes do handler", async () => {
  let chamadasHandler = 0;
  const app = appComValidacao(cardSchema, (_req, res) => {
    chamadasHandler += 1;
    res.sendStatus(204);
  });

  const resposta = await request(app).post("/entrada").send({
    titulo: "Card válido",
    colunaId: "nao-e-uuid",
    prioridade: "urgente",
  });

  assert.equal(resposta.status, 400);
  assert.equal(chamadasHandler, 0);
});

test("ordem negativa ou fracionária para mover card é rejeitada antes do handler", async () => {
  let chamadasHandler = 0;
  const app = appComValidacao(moverCardSchema, (_req, res) => {
    chamadasHandler += 1;
    res.sendStatus(204);
  });
  const colunaId = "00000000-0000-4000-8000-000000000001";

  for (const ordem of [-1, 1.5]) {
    const resposta = await request(app).post("/entrada").send({ colunaId, ordem });
    assert.equal(resposta.status, 400);
  }
  assert.equal(chamadasHandler, 0);
});

test("campos de privilégio desconhecidos são removidos antes do handler", async () => {
  let corpoRecebido;
  const app = appComValidacao(registroSchema, (req, res) => {
    corpoRecebido = req.body;
    res.sendStatus(204);
  });

  const resposta = await request(app).post("/entrada").send({
    nome: "Conta de teste",
    email: "TESTE@EXAMPLE.TEST",
    senha: "senha123",
    role: "owner",
    organizationId: "organizacao-controlada-pelo-cliente",
    tokenVersion: 999,
    emailVerified: true,
    plan: "pro",
    acceptedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(resposta.status, 204);
  assert.deepEqual(Object.keys(corpoRecebido).sort(), ["email", "nome", "senha"]);
  assert.equal(corpoRecebido.email, "teste@example.test");
});
