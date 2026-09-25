const { garantirEmailVerificado } = require("../shared/emailVerificationGuard");

function exigirEmailVerificado(req, res, next) {
  try {
    garantirEmailVerificado(req.user);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = exigirEmailVerificado;