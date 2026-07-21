const cardService = require("../services/card.service");

async function listar(req, res, next) {
  try {
    const cards = await cardService.listar(req.organization.id, req.params.projectId);
    res.json(cards);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const card = await cardService.criar({
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      organizationRole: req.organizationRole,
      ...req.body,
    });
    res.status(201).json(card);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const card = await cardService.atualizar({
      id: req.params.id,
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      organizationRole: req.organizationRole,
      ...req.body,
    });
    res.json(card);
  } catch (err) {
    next(err);
  }
}

async function mover(req, res, next) {
  try {
    await cardService.mover({
      id: req.params.id,
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      organizationRole: req.organizationRole,
      ...req.body,
    });
    res.json({ mensagem: "Card movido" });
  } catch (err) {
    next(err);
  }
}

async function excluir(req, res, next) {
  try {
    await cardService.remover({
      id: req.params.id,
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      organizationRole: req.organizationRole,
    });
    res.json({ mensagem: "Card removido" });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, atualizar, mover, excluir };