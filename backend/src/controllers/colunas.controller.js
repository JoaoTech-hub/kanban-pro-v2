const colunaService = require("../services/coluna.service");

async function listar(req, res, next) {
  try {
    const colunas = await colunaService.listar(req.organization.id, req.params.projectId);
    res.json(colunas);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const coluna = await colunaService.criar({
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      nome: req.body.nome,
      organizationRole: req.organizationRole,
    });
    res.status(201).json(coluna);
  } catch (err) {
    next(err);
  }
}

async function renomear(req, res, next) {
  try {
    await colunaService.renomear({
      id: req.params.id,
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      nome: req.body.nome,
      organizationRole: req.organizationRole,
    });
    res.json({ mensagem: "Coluna atualizada" });
  } catch (err) {
    next(err);
  }
}

async function excluir(req, res, next) {
  try {
    await colunaService.remover({
      id: req.params.id,
      organizationId: req.organization.id,
      projectId: req.params.projectId,
      organizationRole: req.organizationRole,
    });
    res.json({ mensagem: "Coluna removida" });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, renomear, excluir };