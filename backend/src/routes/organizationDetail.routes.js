const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, atualizarOrganizacaoSchema } = require("../validators/schemas");
const controller = require("../controllers/organization.controller");

// Montado em /organizations/:organizationId (path "raiz" da organização,
// diferente de /members ou /invites que são sub-recursos). Hoje só tem
// PATCH / (renomear) — se no futuro surgir mais alguma ação sobre a
// organização em si (não sobre membros/convites), entra aqui.
const router = Router({ mergeParams: true });

router.use(autenticar, requireOrganization);

router.patch("/", validar(atualizarOrganizacaoSchema), controller.atualizarNome);

module.exports = router;