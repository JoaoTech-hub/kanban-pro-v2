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

module.exports = {
  globalLimiter,
};