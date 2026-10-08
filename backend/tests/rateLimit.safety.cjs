const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const backendDir = path.resolve(__dirname, "..");
const childScript = `
  console.error = () => {};
  const request = require("supertest");
  const app = require("./src/app");
  const alvo = JSON.parse(process.env.RATE_LIMIT_TEST_TARGET);

  (async () => {
    for (let tentativa = 0; tentativa < 10; tentativa += 1) {
      const resposta = await request(app).post("/login").send({});
      if (resposta.status !== 400) throw new Error("A requisição-base não passou pelo validador de login.");
    }

    const requisicao = request(app)[alvo.method.toLowerCase()](alvo.path);
    if (alvo.body !== undefined) requisicao.send(alvo.body);
    const resposta = await requisicao;
    if (resposta.status !== 429) throw new Error("O endpoint sensível não aplicou o limite compartilhado.");
    if (!resposta.headers["ratelimit-limit"]) throw new Error("Cabeçalho RateLimit ausente.");
    process.stdout.write("RATE_LIMIT_CONFIRMED");
  })().catch((erro) => {
    process.stderr.write(erro.message);
    process.exitCode = 1;
  });
`;

const globalLimitChildScript = `
  const request = require("supertest");
  const app = require("./src/app");

  (async () => {
    for (let tentativa = 0; tentativa < 100; tentativa += 1) {
      const resposta = await request(app).get("/");
      if (resposta.status !== 200) throw new Error("O limite global bloqueou antes da 101ª requisição.");
    }
    const resposta = await request(app).get("/");
    if (resposta.status !== 429) throw new Error("O limite global não bloqueou a 101ª requisição.");
    process.stdout.write("GLOBAL_LIMIT_CONFIRMED");
  })().catch((erro) => {
    process.stderr.write(erro.message);
    process.exitCode = 1;
  });
`;

const endpointsSensveisSemAcessoAoBanco = [
  { method: "POST", path: "/registro", body: {} },
  { method: "POST", path: "/login", body: {} },
  { method: "POST", path: "/auth/google", body: {} },
  { method: "POST", path: "/esqueci-senha", body: {} },
  { method: "POST", path: "/redefinir-senha", body: {} },
  { method: "POST", path: "/verificar-email", body: {} },
  { method: "POST", path: "/reenviar-verificacao", body: {} },
  { method: "POST", path: "/convites/token-de-teste/aceitar-novo", body: {} },
  { method: "POST", path: "/convites/token-de-teste/aceitar-existente" },
  { method: "GET", path: "/convites/token-de-teste" },
];

for (const alvo of endpointsSensveisSemAcessoAoBanco) {
  test(`${alvo.method} ${alvo.path} aplica o limite real de autenticação`, () => {
    const resultado = spawnSync(process.execPath, ["-e", childScript], {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
        DIRECT_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
        JWT_SECRET: randomBytes(32).toString("hex"),
        FRONTEND_URL: "http://localhost:5173",
        EMAIL_PROVIDER: "disabled",
        RATE_LIMIT_TEST_TARGET: JSON.stringify(alvo),
      },
    });

    assert.equal(resultado.status, 0, resultado.stderr);
    assert.equal(resultado.stdout, "RATE_LIMIT_CONFIRMED");
  });
}

test("limite global permite 100 requests e bloqueia a 101ª sem alterar a configuração", () => {
  const resultado = spawnSync(process.execPath, ["-e", globalLimitChildScript], {
    cwd: backendDir,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      DIRECT_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      JWT_SECRET: randomBytes(32).toString("hex"),
      FRONTEND_URL: "http://localhost:5173",
      EMAIL_PROVIDER: "disabled",
    },
  });

  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stdout, "GLOBAL_LIMIT_CONFIRMED");
});
