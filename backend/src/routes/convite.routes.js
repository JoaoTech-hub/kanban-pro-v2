const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/rateLimiter");
const { validar, aceitarConviteContaNovaSchema } = require("../validators/schemas");
const controller = require("../controllers/invite.controller");

const router = Router();

// Público — a tela de aceite usa isso pra decidir entre mostrar
// formulário de login ou de cadastro (campo `contaExistente`).
router.get("/:token", authLimiter, controller.buscarPorToken);

// Público — cria conta nova e vincula à organização na mesma operação.
router.post(
  "/:token/aceitar-novo",
  authLimiter,
  validar(aceitarConviteContaNovaSchema),
  controller.aceitarContaNova
);

// Autenticado — usuário já tem conta e precisa estar logado com o
// e-mail correspondente ao convite (checado no service).
router.post("/:token/aceitar-existente", authLimiter, autenticar, controller.aceitarContaExistente);

module.exports = router;