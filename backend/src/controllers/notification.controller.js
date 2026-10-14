const notificationService = require("../services/notification.service");

async function listar(req, res, next) {
  try {
    res.json(await notificationService.listar(req.usuarioId));
  } catch (err) {
    next(err);
  }
}

async function marcarComoLida(req, res, next) {
  try {
    await notificationService.marcarComoLida(req.params.id, req.usuarioId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function marcarTodasComoLidas(req, res, next) {
  try {
    await notificationService.marcarTodasComoLidas(req.usuarioId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function aceitarConvite(req, res, next) {
  try {
    res.json(await notificationService.aceitarConvite(req.params.id, req.usuarioId));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, marcarComoLida, marcarTodasComoLidas, aceitarConvite };
