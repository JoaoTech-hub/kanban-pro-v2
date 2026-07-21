const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const controller = require("../controllers/perfil.controller");
const { perfilSchema, senhaSchema, validar } = require("../validators/schemas");

const router = Router();

router.get("/", autenticar, controller.obter);
router.patch("/", autenticar, validar(perfilSchema), controller.atualizar);
router.patch("/senha", autenticar, validar(senhaSchema), controller.alterarSenha);

module.exports = router;