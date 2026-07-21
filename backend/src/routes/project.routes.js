const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, projectSchema, projectRenameSchema } = require("../validators/schemas");
const projectController = require("../controllers/project.controller");

// mergeParams: true é essencial aqui — sem isso, req.params.organizationId
// não chegaria até esse router, já que ele é montado como sub-rota em app.js.
const router = Router({ mergeParams: true });

router.use(autenticar, requireOrganization);

router.post("/", validar(projectSchema), projectController.criar);
router.get("/", projectController.listar);
router.get("/:id", projectController.buscarPorId);
router.patch("/:id", validar(projectRenameSchema), projectController.renomear);
router.delete("/:id", projectController.remover);

module.exports = router;