const { carregarAmbienteTeste } = require("./helpers/loadTestEnvironment");

carregarAmbienteTeste();

process.env.NODE_ENV = "test";
// Usado apenas para inicializar o OAuth2Client nos testes, que mockam
// verifyIdToken e não fazem chamadas reais ao Google.
process.env.GOOGLE_CLIENT_ID = "kanban-pro-test-client-id.apps.googleusercontent.com";

// O banco de teste (branch do Neon) hiberna quando fica ocioso e leva alguns
// segundos pra "acordar" na primeira consulta. 30s é uma margem segura,
// sem mascarar testes que realmente travem por bug (isso ainda estouraria).
jest.setTimeout(30000);
