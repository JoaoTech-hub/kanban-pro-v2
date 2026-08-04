const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, alterarRoleSchema, transferirOwnershipSchema } = require("../validators/schemas");
const controller = require("../controllers/organization.controller");

// mergeParams: true — sem isso, req.params.organizationId não chegaria
// até este router (mesma observação já feita em project.routes.js).
const router = Router({ mergeParams: true });

router.use(autenticar, requireOrganization);

router.get("/", controller.listarMembros);

// IMPORTANTE: "/me" e "/transfer-ownership" precisam ser registrados ANTES
// de "/:userId" — senão o Express casaria essas strings literais como se
// fossem o valor de :userId (ex.: DELETE /members/me seria interpretado como
// "remover o membro cujo userId é a string 'me'"), quebrando as duas rotas.
router.delete("/me", controller.sair);
router.post("/transfer-ownership", validar(transferirOwnershipSchema), controller.transferirOwnership);

router.patch("/:userId", validar(alterarRoleSchema), controller.alterarRoleMembro);
router.delete("/:userId", controller.removerMembro);

module.exports = router;