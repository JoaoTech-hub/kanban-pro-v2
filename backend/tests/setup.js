const { carregarAmbienteTeste } = require("./helpers/loadTestEnvironment");

carregarAmbienteTeste();

process.env.NODE_ENV = "test";

// O banco de teste (branch do Neon) hiberna quando fica ocioso e leva alguns
// segundos pra "acordar" na primeira consulta. 30s é uma margem segura,
// sem mascarar testes que realmente travem por bug (isso ainda estouraria).
jest.setTimeout(30000);