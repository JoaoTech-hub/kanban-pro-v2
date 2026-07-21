const projectService = require("../services/project.service");
const { paginacaoQuerySchema } = require("../validators/schemas");

async function criar(req, res, next) {
  try {
    const project = await projectService.criar({
      organization: req.organization,
      organizationRole: req.organizationRole,
      ...req.body,
    });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

async function listar(req, res, next) {
  try {
    // Valida e aplica os padrões de página e limite via Zod
    const { pagina, limite } = paginacaoQuerySchema.parse(req.query);

    const resultado = await projectService.listar(req.organization.id, { pagina, limite });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const project = await projectService.buscarPorId(req.params.id, req.organization.id);
    res.json(project);
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await projectService.remover(req.params.id, req.organization.id, req.organizationRole);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function renomear(req, res, next) {
  try {
    await projectService.renomear(
      req.params.id,
      req.organization.id,
      req.organizationRole,
      req.body.name
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { criar, listar, buscarPorId, remover, renomear };