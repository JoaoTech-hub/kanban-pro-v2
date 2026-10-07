const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/user.repository");

const SEGREDO = process.env.JWT_SECRET;

async function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ erro: "Não autenticado", codigo: "SESSAO_INVALIDA" });
  }

  let dados;
  try {
    // algorithms explícito: nunca aceita um token assinado com outro algoritmo
    // além do que usamos pra emitir (defesa contra confusão de algoritmo).
    dados = jwt.verify(token, SEGREDO, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ erro: "Token inválido", codigo: "SESSAO_INVALIDA" });
  }

  try {
    // Confere se a versão do token ainda é a atual — permite revogar tokens
    // antigos (ex: após troca de senha) sem esperar os 7 dias de expiração.
    const user = await userRepository.findById(dados.id);
    if (!user || user.tokenVersion !== dados.tokenVersion) {
      return res.status(401).json({ erro: "Token inválido", codigo: "SESSAO_INVALIDA" });
    }

    req.usuarioId = dados.id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { autenticar, SEGREDO };
