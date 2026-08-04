const prisma = require("../config/db");

function create({ name, slug, plan = "free" }, client = prisma) {
  return client.organization.create({ data: { name, slug, plan } });
}

function findById(id) {
  return prisma.organization.findUnique({ where: { id } });
}

function updatePlan(id, plan) {
  if (!id) throw new Error("updatePlan chamado sem um id de organização válido");
  return prisma.organization.update({ where: { id }, data: { plan } });
}

function updateName(id, name) {
  if (!id) throw new Error("updateName chamado sem um id de organização válido");
  return prisma.organization.update({ where: { id }, data: { name } });
}

// Trava a linha da organização até o fim da transação (client precisa ser o
// `tx` de um prisma.$transaction — travar fora de uma transação não tem
// efeito nenhum). Usado para serializar operações que dependem de contar
// registros relacionados antes de decidir se podem prosseguir (ex.: limite
// de projetos do plano gratuito), evitando que duas requisições concorrentes
// leiam a mesma contagem "desatualizada" antes de qualquer uma escrever.
function lockForUpdate(id, client) {
  return client.$queryRaw`SELECT id FROM organizations WHERE id = ${id} FOR UPDATE`;
}

module.exports = { create, findById, updatePlan, updateName, lockForUpdate };