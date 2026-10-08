const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const backendDir = path.resolve(__dirname, "..");
const originPermitida = "https://app.example.test";
const childScript = `
  console.error = () => {};
  const jwt = require("jsonwebtoken");
  const request = require("supertest");
  const app = require("./src/app");

  (async () => {
    const permitida = await request(app).get("/").set("Origin", process.env.CORS_ALLOWED_ORIGIN);
    const bloqueada = await request(app).get("/").set("Origin", "https://unlisted.example.test");
    const tokenExpirado = jwt.sign({ id: "usuario-sintetico", tokenVersion: 0 }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: -1,
    });
    const tokenAlgoritmoNaoPermitido = jwt.sign(
      { id: "usuario-sintetico", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS384", expiresIn: "1h" }
    );
    const jwtInvalido = [];
    for (const authorization of [
      undefined,
      "Bearer malformado",
      "Bearer " + tokenExpirado,
      "Bearer " + tokenAlgoritmoNaoPermitido,
    ]) {
      const requisicao = request(app).get("/perfil");
      if (authorization) requisicao.set("Authorization", authorization);
      const resposta = await requisicao;
      jwtInvalido.push({ status: resposta.status, codigo: resposta.body.codigo });
    }
    process.stdout.write(JSON.stringify({
      permitida: {
        status: permitida.status,
        allowOrigin: permitida.headers["access-control-allow-origin"],
        allowCredentials: permitida.headers["access-control-allow-credentials"],
        contentTypeOptions: permitida.headers["x-content-type-options"],
        frameOptions: permitida.headers["x-frame-options"],
        contentSecurityPolicy: permitida.headers["content-security-policy"],
      },
      bloqueada: {
        status: bloqueada.status,
        allowOrigin: bloqueada.headers["access-control-allow-origin"],
        body: bloqueada.body,
      },
      jwtInvalido,
    }));
  })().catch((erro) => {
    process.stderr.write(erro.message);
    process.exitCode = 1;
  });
`;

test("app real em produção limita CORS e envia headers/erros sem detalhes internos", () => {
  const resultado = spawnSync(process.execPath, ["-e", childScript], {
    cwd: backendDir,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      DIRECT_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      JWT_SECRET: randomBytes(32).toString("hex"),
      FRONTEND_URL: originPermitida,
      CORS_ALLOWED_ORIGIN: originPermitida,
      EMAIL_PROVIDER: "disabled",
    },
  });

  assert.equal(resultado.status, 0, resultado.stderr);
  const resposta = JSON.parse(resultado.stdout);

  assert.equal(resposta.permitida.status, 200);
  assert.equal(resposta.permitida.allowOrigin, originPermitida);
  assert.equal(resposta.permitida.allowCredentials, undefined);
  assert.equal(resposta.permitida.contentTypeOptions, "nosniff");
  assert.equal(resposta.permitida.frameOptions, "SAMEORIGIN");
  assert.match(resposta.permitida.contentSecurityPolicy, /default-src 'self'/);

  assert.ok(resposta.bloqueada.status >= 400);
  assert.equal(resposta.bloqueada.allowOrigin, undefined);
  assert.deepEqual(resposta.bloqueada.body, { erro: "Erro interno do servidor" });
  assert.deepEqual(resposta.jwtInvalido, Array.from({ length: 4 }, () => ({
    status: 401,
    codigo: "SESSAO_INVALIDA",
  })));
});
