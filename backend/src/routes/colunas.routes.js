const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, colunaSchema } = require("../validators/schemas");
const colunasController = require("../controllers/colunas.controller");

const router = Router({ mergeParams: true });

const requireProject = require("../middlewares/requireProject");
// ...
router.use(autenticar, requireOrganization, requireProject);

router.get("/", colunasController.listar);
router.post("/", validar(colunaSchema), colunasController.criar);
router.patch("/:id", validar(colunaSchema), colunasController.renomear);
router.delete("/:id", colunasController.excluir);

module.exports = router;