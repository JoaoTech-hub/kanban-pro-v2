const organizationRepository = require("../repositories/organization.repository");
const organizationMemberRepository = require("../repositories/organizationMember.repository");
const { NotFoundError, ForbiddenError } = require("../shared/errors/AppError");
const { garantirEmailVerificado } = require("../shared/emailVerificationGuard");

async function requireOrganization(req, res, next) {
  try {
    garantirEmailVerificado(req.user);

    const { organizationId } = req.params;

    if (!organizationId) {
      throw new NotFoundError("Organização não informada na rota");
    }

    const membership = await organizationMemberRepository.findByUserAndOrgComOrganizacao(
      req.usuarioId,
      organizationId
    );

    if (membership) {
      req.organization = membership.organization;
      req.organizationRole = membership.role;
      return next();
    }

    const organization = await organizationRepository.findById(organizationId);
    if (!organization) {
      throw new NotFoundError("Organização não encontrada");
    }

    throw new ForbiddenError("Você não pertence a esta organização");
  } catch (err) {
    next(err);
  }
}

module.exports = requireOrganization;