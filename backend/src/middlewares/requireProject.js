const projectRepository = require("../repositories/project.repository");
const { NotFoundError } = require("../shared/errors/AppError");

// Roda DEPOIS de requireOrganization. Garante que :projectId da URL existe
// e pertence à organização já validada. Sem isso, listar colunas/cards com
// um projectId forjado (de outra organização, ou inexistente) retornava
// 200 com lista vazia, em vez de 404 — inconsistente com o resto da API,
// que já faz essa checagem em operações de recurso único (buscarPorId).
async function requireProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await projectRepository.findByIdAndOrganization(projectId, req.organization.id);

    if (!project) {
      throw new NotFoundError("Projeto não encontrado");
    }

    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireProject;