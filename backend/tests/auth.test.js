const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");

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

  test("logout autenticado incrementa tokenVersion, revoga todos os JWTs do usuário e preserva outros usuários", async () => {
    const sufixo = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const usuarioLogout = {
      nome: "Usuário Logout",
      email: `logout_${sufixo}@teste.com`,
      senha: "senha123",
    };
    const usuarioAlheio = {
      nome: "Usuário Alheio",
      email: `alheio_${sufixo}@teste.com`,
      senha: "senha123",
    };

    const registroLogout = await request(app).post("/registro").send(usuarioLogout);
    const loginAdicional = await request(app).post("/login").send({
      email: usuarioLogout.email,
      senha: usuarioLogout.senha,
    });
    const registroAlheio = await request(app).post("/registro").send(usuarioAlheio);
    expect(registroLogout.status).toBe(200);
    expect(loginAdicional.status).toBe(200);
    expect(registroAlheio.status).toBe(200);

    const userId = (await prisma.user.findUnique({ where: { email: usuarioLogout.email } })).id;
    const otherUserId = (await prisma.user.findUnique({ where: { email: usuarioAlheio.email } })).id;
    const [versionBefore, otherVersionBefore] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }),
      prisma.user.findUnique({ where: { id: otherUserId }, select: { tokenVersion: true } }),
    ]);

    const unauthenticated = await request(app).post("/auth/logout");
    expect(unauthenticated.status).toBe(401);

    const profileBefore = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${registroLogout.body.token}`);
    expect(profileBefore.status).toBe(200);

    const logout = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${registroLogout.body.token}`);
    expect(logout.status).toBe(200);
    expect(logout.body.mensagem).toBe("Logout efetuado com sucesso");

    const [versionAfter, otherVersionAfter] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }),
      prisma.user.findUnique({ where: { id: otherUserId }, select: { tokenVersion: true } }),
    ]);
    expect(versionAfter.tokenVersion).toBe(versionBefore.tokenVersion + 1);
    expect(otherVersionAfter.tokenVersion).toBe(otherVersionBefore.tokenVersion);

    // O token entregue no registro e o token de outro login são ambos
    // rejeitados: tokenVersion não distingue sessões individuais.
    const originalToken = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${registroLogout.body.token}`);
    const additionalToken = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${loginAdicional.body.token}`);
    const unaffectedUser = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${registroAlheio.body.token}`);
    expect(originalToken.status).toBe(401);
    expect(additionalToken.status).toBe(401);
    expect(unaffectedUser.status).toBe(200);
  });
});
