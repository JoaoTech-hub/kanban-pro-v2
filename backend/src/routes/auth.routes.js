const { Router } = require("express");
const {
  registrar,
  login,
  loginGoogle,
  esqueciSenha,
  redefinirSenha,
  verificarEmail,
  reenviarVerificacao,
} = require("../controllers/auth.controller");
const {
  registroSchema,
  loginSchema,
  googleLoginSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  verificarEmailSchema,
  validar,
} = require("../validators/schemas");
const { authLimiter } = require("../middlewares/rateLimiter");
const { autenticar } = require("../middlewares/auth");

const router = Router();

router.post("/registro", authLimiter, validar(registroSchema), registrar);
router.post("/login", authLimiter, validar(loginSchema), login);
router.post("/auth/google", authLimiter, validar(googleLoginSchema), loginGoogle);
router.post("/esqueci-senha", authLimiter, validar(esqueciSenhaSchema), esqueciSenha);
router.post("/redefinir-senha", authLimiter, validar(redefinirSenhaSchema), redefinirSenha);
router.post("/verificar-email", authLimiter, validar(verificarEmailSchema), verificarEmail);
router.post("/reenviar-verificacao", authLimiter, autenticar, reenviarVerificacao);

module.exports = router;