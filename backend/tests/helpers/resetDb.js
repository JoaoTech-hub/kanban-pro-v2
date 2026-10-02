const { carregarAmbienteTeste } = require("./loadTestEnvironment");
const { executarSeBancoDeTesteSeguro, validarBancoDeTeste } = require("./testDatabaseSafety");

carregarAmbienteTeste();
// A validação ocorre no carregamento, antes de importar/inicializar Prisma.
validarBancoDeTeste(process.env);

const prisma = require("../../src/config/db");

// Apagar Organization já em cascata apaga OrganizationMember, Project, Coluna e Card
// (definido como onDelete: Cascade no schema.prisma). Só falta apagar User à parte.
async function limparBanco() {
  await executarSeBancoDeTesteSeguro(process.env, async () => {
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });
}

module.exports = { limparBanco, prisma };