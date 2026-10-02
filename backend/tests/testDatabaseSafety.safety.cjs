const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { validarBancoDeTeste, executarSeBancoDeTesteSeguro } = require("./helpers/testDatabaseSafety");

const BRANCH = "ep-dedicated-test-branch-123";
const envSeguro = {
  NODE_ENV: "test",
  CONFIRM_TEST_DB_RESET: "YES",
  TEST_DATABASE_MARKER: BRANCH,
  DATABASE_URL: `postgresql://user:password@${BRANCH}-pooler.c-1.us-east-1.aws.neon.tech/testdb?sslmode=require`,
  DIRECT_URL: `postgresql://user:password@${BRANCH}.c-1.us-east-1.aws.neon.tech/testdb?sslmode=require`,
};

test("aceita somente endpoints Neon que correspondem ao marcador e entre si", () => {
  assert.deepEqual(validarBancoDeTeste(envSeguro), {
    branchId: BRANCH,
    databaseName: "testdb",
  });
});

test("rejeita falta de confirmação explícita mesmo com NODE_ENV=test", () => {
  const env = { ...envSeguro, CONFIRM_TEST_DB_RESET: undefined };
  assert.throws(() => validarBancoDeTeste(env), /CONFIRM_TEST_DB_RESET/);
});

test("rejeita NODE_ENV diferente de test mesmo com confirmação e marcador corretos", () => {
  assert.throws(() => validarBancoDeTeste({ ...envSeguro, NODE_ENV: "production" }), /NODE_ENV=test/);
});

test("rejeita falta ou divergência do marcador da branch", () => {
  assert.throws(() => validarBancoDeTeste({ ...envSeguro, TEST_DATABASE_MARKER: undefined }), /TEST_DATABASE_MARKER/);
  assert.throws(() => validarBancoDeTeste({ ...envSeguro, TEST_DATABASE_MARKER: "ep-other-branch" }), /corresponder exatamente/);
});

test("rejeita host não Neon ou URL inválida mesmo com confirmação", () => {
  assert.throws(
    () => validarBancoDeTeste({ ...envSeguro, DATABASE_URL: "postgresql://user:password@localhost/testdb" }),
    /branch Neon de testes/
  );
  assert.throws(() => validarBancoDeTeste({ ...envSeguro, DIRECT_URL: "not-a-url" }), /URL PostgreSQL válida/);
});

test("rejeita DATABASE_URL e DIRECT_URL com bancos diferentes", () => {
  const env = {
    ...envSeguro,
    DIRECT_URL: envSeguro.DIRECT_URL.replace("/testdb?", "/anotherdb?"),
  };
  assert.throws(() => validarBancoDeTeste(env), /mesmo banco de testes/);
});

test("rejeita a configuração insegura antes de chamar qualquer exclusão", async () => {
  let exclusoesExecutadas = 0;
  await assert.rejects(
    executarSeBancoDeTesteSeguro(
      { ...envSeguro, CONFIRM_TEST_DB_RESET: undefined },
      async () => { exclusoesExecutadas += 1; }
    ),
    /CONFIRM_TEST_DB_RESET/
  );
  assert.equal(exclusoesExecutadas, 0);
});

test("globalSetup rejeita configuração insegura antes de importar Prisma", () => {
  const globalSetupPath = path.join(__dirname, "globalSetup.js");
  const script = `
    const Module = require("node:module");
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === "dotenv") return { config: () => ({}) };
      if (request.endsWith("src/config/db")) throw new Error("PRISMA_IMPORTED");
      return originalLoad.call(this, request, parent, isMain);
    };
    process.env.NODE_ENV = "test";
    delete process.env.CONFIRM_TEST_DB_RESET;
    delete process.env.TEST_DATABASE_MARKER;
    try {
      require(${JSON.stringify(globalSetupPath)});
      process.exitCode = 2;
    } catch (error) {
      if (error.message.includes("CONFIRM_TEST_DB_RESET")) {
        console.log("blocked before Prisma import");
      } else {
        process.exitCode = 3;
      }
    }
  `;

  const resultado = spawnSync(process.execPath, ["-e", script], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  });

  assert.equal(resultado.status, 0, resultado.stderr);
  assert.match(resultado.stdout, /blocked before Prisma import/);
});