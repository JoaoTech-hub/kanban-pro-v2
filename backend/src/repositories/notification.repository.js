const prisma = require("../config/db");

function create({ userId, message, type = "general", inviteId = null }, client = prisma) {
  const data = { userId, message, type, inviteId };
  if (!inviteId) return client.notification.create({ data });

  return client.notification.upsert({
    where: { userId_inviteId_type: { userId, inviteId, type } },
    create: data,
    update: { message },
  });
}

function findByUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      invite: {
        select: {
          id: true,
          acceptedAt: true,
          revokedAt: true,
          expiresAt: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });
}

function findInviteByUser(id, userId) {
  return prisma.notification.findFirst({
    where: { id, userId, type: "invite_received", inviteId: { not: null } },
    select: { id: true, inviteId: true },
  });
}

function countUnread(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

async function markRead(id, userId) {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

module.exports = { create, findByUser, findInviteByUser, countUnread, markRead, markAllRead };
