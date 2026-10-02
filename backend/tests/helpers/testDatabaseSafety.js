const CONFIRMATION_VARIABLE = "CONFIRM_TEST_DB_RESET";
const MARKER_VARIABLE = "TEST_DATABASE_MARKER";
const EXPECTED_CONFIRMATION = "YES";

function lerAlvoNeon(nomeVariavel, valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${nomeVariavel} não contém uma URL PostgreSQL válida.`);
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${nomeVariavel} precisa usar o protocolo PostgreSQL.`);
  }

  const hostLabels = url.hostname.toLowerCase().split(".");
  if (hostLabels.length < 3 || !url.hostname.toLowerCase().endsWith(".neon.tech")) {
    throw new Error(`${nomeVariavel} precisa apontar para a branch Neon de testes identificada pelo marcador.`);
  }

  const branchId = hostLabels[0].replace(/-pooler$/, "");
  if (!/^ep-[a-z0-9-]+$/.test(branchId)) {
    throw new Error(`${nomeVariavel} não contém um identificador de branch Neon reconhecível.`);
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!databaseName) {
    throw new Error(`${nomeVariavel} não identifica um banco PostgreSQL.`);
  }

  return { branchId, databaseName };
}

function validarBancoDeTeste(env) {
  if (env.NODE_ENV !== "test") {
    throw new Error("NODE_ENV=test é obrigatório para permitir a limpeza do banco de testes.");
  }

  if (env[CONFIRMATION_VARIABLE] !== EXPECTED_CONFIRMATION) {
    throw new Error(`${CONFIRMATION_VARIABLE}=YES é obrigatório para permitir a limpeza do banco de testes.`);
  }

  const marker = env[MARKER_VARIABLE]?.trim().toLowerCase();
  if (!marker || !/^ep-[a-z0-9-]+$/.test(marker)) {
    throw new Error(`${MARKER_VARIABLE} deve conter o identificador dedicado da branch Neon de testes.`);
  }

  const databaseUrl = lerAlvoNeon("DATABASE_URL", env.DATABASE_URL || "");
  const directUrl = lerAlvoNeon("DIRECT_URL", env.DIRECT_URL || "");

  if (databaseUrl.branchId !== marker || directUrl.branchId !== marker) {
    throw new Error(`${MARKER_VARIABLE} precisa corresponder exatamente à branch Neon em DATABASE_URL e DIRECT_URL.`);
  }

  if (databaseUrl.databaseName !== directUrl.databaseName) {
    throw new Error("DATABASE_URL e DIRECT_URL precisam apontar para o mesmo banco de testes.");
  }

  return { branchId: marker, databaseName: databaseUrl.databaseName };
}

async function executarSeBancoDeTesteSeguro(env, operacaoDestrutiva) {
  validarBancoDeTeste(env);
  return operacaoDestrutiva();
}

module.exports = { validarBancoDeTeste, executarSeBancoDeTesteSeguro };