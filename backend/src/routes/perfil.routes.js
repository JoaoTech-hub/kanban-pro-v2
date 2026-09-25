const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const exigirEmailVerificado = require("../middlewares/exigirEmailVerificado");
const controller = require("../controllers/perfil.controller");
const { perfilSchema, senhaSchema, validar } = require("../validators/schemas");

const router = Router();

router.get("/", autenticar, controller.obter);
router.patch("/", autenticar, exigirEmailVerificado, validar(perfilSchema), controller.atualizar);
router.patch(
  "/senha",
  autenticar,
  exigirEmailVerificado,
  validar(senhaSchema),
  controller.alterarSenha
);

module.exports = router;