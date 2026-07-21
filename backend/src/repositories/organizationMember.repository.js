const prisma = require("../config/db");

function create({ organizationId, userId, role = "member" }, client = prisma) {
  return client.organizationMember.create({
    data: { organizationId, userId, role },
  });
}

function findByUserAndOrg(userId, organizationId) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

function findFirstByUser(userId) {
  return prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
}

module.exports = { create, findByUserAndOrg, findFirstByUser };