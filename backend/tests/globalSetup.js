const { limparBanco, prisma } = require("./helpers/resetDb");

module.exports = async function globalSetup() {
  await limparBanco();
  await prisma.$disconnect();
};