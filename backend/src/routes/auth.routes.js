const { Router } = require("express");
const { registrar, login, esqueciSenha, redefinirSenha } = require("../controllers/auth.controller");
const {
  registroSchema,
  loginSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  validar,
} = require("../validators/schemas");
const { authLimiter } = require("../middlewares/rateLimiter");

const router = Router();

router.post("/registro", authLimiter, validar(registroSchema), registrar);
router.post("/login", authLimiter, validar(loginSchema), login);
router.post("/esqueci-senha", authLimiter, validar(esqueciSenhaSchema), esqueciSenha);
router.post("/redefinir-senha", authLimiter, validar(redefinirSenhaSchema), redefinirSenha);

module.exports = router;