const request = require("supertest");
const app = require("../src/app");

describe("Autenticação", () => {
  const usuario = {
    nome: "Maria Teste",
    email: `maria_${Date.now()}@teste.com`,
    senha: "senha123",
  };

  test("cria uma conta nova com sucesso", async () => {
    const res = await request(app).post("/registro").send(usuario);
    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBeDefined();
  });

  test("não permite registrar o mesmo e-mail duas vezes", async () => {
    const res = await request(app).post("/registro").send(usuario);
    expect(res.status).toBe(409);
  });

  test("faz login com credenciais corretas e recebe um token", async () => {
    const res = await request(app).post("/login").send({
      email: usuario.email,
      senha: usuario.senha,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("rejeita login com senha errada", async () => {
    const res = await request(app).post("/login").send({
      email: usuario.email,
      senha: "senhaErrada",
    });
    expect(res.status).toBe(401);
  });

  test("rejeita registro com senha curta demais", async () => {
    const res = await request(app).post("/registro").send({
      nome: "Fulano",
      email: `fulano_${Date.now()}@teste.com`,
      senha: "123",
    });
    expect(res.status).toBe(400);
  });

  test("bloqueia acesso a rota protegida sem token", async () => {
    const idQualquer = "00000000-0000-0000-0000-000000000000";
    const res = await request(app).get(`/organizations/${idQualquer}/projects`);
    expect(res.status).toBe(401);
  });
});