const organizationService = require("../services/organization.service");

async function listarMinhas(req, res, next) {
  try {
    const organizacoes = await organizationService.listarMinhas(req.usuarioId);
    res.json(organizacoes);
  } catch (err) {
    next(err);
  }
}

async function listarMembros(req, res, next) {
  try {
    const membros = await organizationService.listarMembros(req.organization.id);
    res.json(membros);
  } catch (err) {
    next(err);
  }
}

async function alterarRoleMembro(req, res, next) {
  try {
    await organizationService.alterarRole(
      req.organization.id,
      req.organizationRole,
      req.params.userId,
      req.body.role
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function removerMembro(req, res, next) {
  try {
    await organizationService.removerMembro(
      req.organization.id,
      req.organizationRole,
      req.params.userId,
      req.usuarioId
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listarMinhas, listarMembros, alterarRoleMembro, removerMembro };