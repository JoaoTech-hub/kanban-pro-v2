const projectService = require("../services/project.service");

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
    const projects = await projectService.listar(req.organization.id);
    res.json(projects);
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