const { PrismaClient } = require("@prisma/client");

// Evita esgotar conexões durante hot-reload em desenvolvimento (node --watch recria o módulo).
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;