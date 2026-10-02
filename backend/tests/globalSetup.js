const { carregarAmbienteTeste } = require("./helpers/loadTestEnvironment");
const { validarBancoDeTeste } = require("./helpers/testDatabaseSafety");

carregarAmbienteTeste();
// Verifica o alvo antes de importar resetDb (que inicializa o cliente Prisma)
// e, principalmente, antes de qualquer operação de exclusão.
validarBancoDeTeste(process.env);

const { limparBanco, prisma } = require("./helpers/resetDb");

module.exports = async function globalSetup() {
  await limparBanco();
  await prisma.$disconnect();
};