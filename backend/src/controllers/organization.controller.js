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

// Self-service — a pessoa autenticada sai da própria organização. Retorna a
// lista atualizada de organizações do usuário, pra o frontend trocar direto
// pra outra sem uma segunda chamada.
async function sair(req, res, next) {
  try {
    const organizacoes = await organizationService.sair(
      req.organization.id,
      req.organizationRole,
      req.usuarioId
    );
    res.json({ organizacoes });
  } catch (err) {
    next(err);
  }
}

async function transferirOwnership(req, res, next) {
  try {
    await organizationService.transferirOwnership(
      req.organization.id,
      req.organizationRole,
      req.usuarioId,
      req.body.novoOwnerUserId
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function atualizarNome(req, res, next) {
  try {
    const organizacao = await organizationService.atualizarNome(
      req.organization.id,
      req.organizationRole,
      req.body.name
    );
    res.json({ id: organizacao.id, name: organizacao.name });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarMinhas,
  listarMembros,
  alterarRoleMembro,
  removerMembro,
  sair,
  transferirOwnership,
  atualizarNome,
};