const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env.test") });

const prisma = require("../../src/config/db");

// Apagar Organization já em cascata apaga OrganizationMember, Project, Coluna e Card
// (definido como onDelete: Cascade no schema.prisma). Só falta apagar User à parte.
async function limparBanco() {
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = { limparBanco, prisma };