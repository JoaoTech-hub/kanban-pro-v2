const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const backendDir = path.resolve(__dirname, "..");
const script = 'require("./src/config/env"); process.stdout.write("CONFIG_ACCEPTED");';

function validarConfiguracao(jwtSecret, extras = {}) {
  return spawnSync(process.execPath, ["-e", script], {
    cwd: backendDir,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test_db",
      JWT_SECRET: jwtSecret,
      ...extras,
    },
  });
}

test("rejeita JWT_SECRET menor que 32 bytes sem revelar o valor", () => {
  const segredoCurtoDeTeste = "segredo-sintetico-curto-123";
  const resultado = validarConfiguracao(segredoCurtoDeTeste);

  assert.notEqual(resultado.status, 0);
  assert.match(resultado.stderr, /JWT_SECRET deve ter pelo menos 32 bytes/);
  assert.equal(resultado.stderr.includes(segredoCurtoDeTeste), false);
  assert.equal(resultado.stdout.includes(segredoCurtoDeTeste), false);
});

test("rejeita um segredo longo composto por sequência repetitiva", () => {
  const resultado = validarConfiguracao("x".repeat(64));

  assert.notEqual(resultado.status, 0);
  assert.match(resultado.stderr, /placeholder ou uma sequência repetitiva/);
});

test("aceita um segredo aleatório com pelo menos 32 bytes", () => {
  const segredoForteDeTeste = randomBytes(32).toString("base64url");
  const resultado = validarConfiguracao(segredoForteDeTeste);

  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stdout, "CONFIG_ACCEPTED");
  assert.equal(resultado.stdout.includes(segredoForteDeTeste), false);
});

test("aceita configuração de produção válida com segredo forte", () => {
  const segredoForteDeTeste = randomBytes(32).toString("hex");
  const resultado = validarConfiguracao(segredoForteDeTeste, {
    NODE_ENV: "production",
    FRONTEND_URL: "https://app.example.test",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "chave-sintetica-de-teste",
    EMAIL_FROM: "test@example.test",
  });

  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stdout, "CONFIG_ACCEPTED");
  assert.equal(resultado.stderr.includes(segredoForteDeTeste), false);
});
