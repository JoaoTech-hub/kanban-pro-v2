const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { registrar, login, esqueciSenha, redefinirSenha } = require("../controllers/auth.controller");
const {
  registroSchema,
  loginSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  validar,
} = require("../validators/schemas");

const router = Router();

const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { erro: "Muitas tentativas. Tente novamente em alguns minutos." },
});

router.post("/registro", limiteAuth, validar(registroSchema), registrar);
router.post("/login", limiteAuth, validar(loginSchema), login);
router.post("/esqueci-senha", limiteAuth, validar(esqueciSenhaSchema), esqueciSenha);
router.post("/redefinir-senha", limiteAuth, validar(redefinirSenhaSchema), redefinirSenha);

module.exports = router;