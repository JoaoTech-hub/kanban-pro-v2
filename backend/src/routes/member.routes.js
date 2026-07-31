const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, alterarRoleSchema } = require("../validators/schemas");
const controller = require("../controllers/organization.controller");

// mergeParams: true — sem isso, req.params.organizationId não chegaria
// até este router (mesma observação já feita em project.routes.js).
const router = Router({ mergeParams: true });

router.use(autenticar, requireOrganization);

router.get("/", controller.listarMembros);
router.patch("/:userId", validar(alterarRoleSchema), controller.alterarRoleMembro);
router.delete("/:userId", controller.removerMembro);

module.exports = router;