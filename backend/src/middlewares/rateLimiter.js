const rateLimit = require("express-rate-limit");

/**
 * Limitador de taxa global para toda a API.
 * Permite até 100 requisições por IP em uma janela de 15 minutos.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true, // Retorna cabeçalhos no padrão moderno `RateLimit-*`
  legacyHeaders: false, // Desabilita os cabeçalhos legados `X-RateLimit-*`
  skip: () => process.env.NODE_ENV === "test", // Garante que testes automatizados não sejam bloqueados
  message: {
    erro: "Muitas requisições originadas deste IP. Tente novamente em alguns minutos.",
  },
});

// Limitador mais apertado para rotas sensíveis a força bruta: login,
// registro, reset de senha e, agora, aceite de convite (novo alvo de
// tentativa de adivinhar token — Feature 6.8). Antes vivia duplicado
// inline em auth.routes.js; centralizado aqui para não haver duas fontes
// de verdade sobre essa política.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { erro: "Muitas tentativas. Tente novamente em alguns minutos." },
});

module.exports = {
  globalLimiter,
  authLimiter,
};