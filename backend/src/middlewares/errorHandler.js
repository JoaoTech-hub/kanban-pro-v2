// Middleware de erro global do Express.
// Qualquer `next(err)` chamado em rotas/controllers cai aqui.
// Garante que o cliente sempre recebe um JSON consistente,
// e que detalhes internos (stack trace, mensagens do driver do banco)
// nunca vazam para a resposta em produção.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  const emProducao = process.env.NODE_ENV === "production";

  res.status(err.status || 500).json({
    erro: emProducao ? "Erro interno do servidor" : err.message || "Erro interno do servidor",
    ...(err.codigo ? { codigo: err.codigo } : {}),
  });
}

module.exports = errorHandler;