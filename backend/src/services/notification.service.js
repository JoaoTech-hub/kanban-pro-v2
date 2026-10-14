const notificationRepository = require("../repositories/notification.repository");
const { NotFoundError } = require("../shared/errors/AppError");
const inviteService = require("./invite.service");

async function listar(userId) {
  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.findByUser(userId),
    notificationRepository.countUnread(userId),
  ]);
  return { notifications, unreadCount };
}

async function marcarComoLida(id, userId) {
  if (!(await notificationRepository.markRead(id, userId))) {
    throw new NotFoundError("Notificação não encontrada");
  }
}

function marcarTodasComoLidas(userId) {
  return notificationRepository.markAllRead(userId);
}

async function aceitarConvite(notificationId, userId) {
  const notification = await notificationRepository.findInviteByUser(notificationId, userId);
  if (!notification) throw new NotFoundError("Notificação de convite não encontrada");

  const resultado = await inviteService.aceitarContaExistentePorId(notification.inviteId, userId);
  try {
    await notificationRepository.markRead(notificationId, userId);
  } catch (err) {
    console.error("Falha ao marcar notificação de convite como lida:", err);
  }
  return resultado;
}

module.exports = { listar, marcarComoLida, marcarTodasComoLidas, aceitarConvite };
