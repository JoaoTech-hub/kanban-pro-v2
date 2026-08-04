const organizationRepository = require("../repositories/organization.repository");
const organizationMemberRepository = require("../repositories/organizationMember.repository");
const { NotFoundError, ForbiddenError } = require("../shared/errors/AppError");

// Roda DEPOIS do middleware `autenticar` (precisa de req.usuarioId já definido).
// Única fonte de verdade da organização ativa: o parâmetro :organizationId da URL.
// Não existe mais header paralelo — evita qualquer inconsistência entre duas fontes de dado.
//
// Caminho feliz (a esmagadora maioria das requisições): 1 única consulta com
// JOIN, trazendo o vínculo e a organização juntos — antes eram 2 consultas
// separadas sempre. A segunda consulta só acontece no caminho de erro (raro),
// e só para decidir a mensagem certa (organização inexistente vs. sem
// vínculo) — preserva exatamente o mesmo contrato de antes (status e
// mensagem), só sem pagar o custo extra quando dá tudo certo.
async function requireOrganization(req, res, next) {
  try {
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