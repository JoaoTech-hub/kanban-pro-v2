const organizationRepository = require("../repositories/organization.repository");
const organizationMemberRepository = require("../repositories/organizationMember.repository");
const { NotFoundError, ForbiddenError } = require("../shared/errors/AppError");

// Roda DEPOIS do middleware `autenticar` (precisa de req.usuarioId já definido).
// Única fonte de verdade da organização ativa: o parâmetro :organizationId da URL.
// Não existe mais header paralelo — evita qualquer inconsistência entre duas fontes de dado.
async function requireOrganization(req, res, next) {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new NotFoundError("Organização não informada na rota");
    }

    const organization = await organizationRepository.findById(organizationId);
    if (!organization) {
      throw new NotFoundError("Organização não encontrada");
    }

    const membership = await organizationMemberRepository.findByUserAndOrg(
      req.usuarioId,
      organizationId
    );

    if (!membership) {
      throw new ForbiddenError("Você não pertence a esta organização");
    }

    req.organization = organization;
    req.organizationRole = membership.role;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireOrganization;