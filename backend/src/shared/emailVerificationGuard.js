const { EmailNaoVerificadoError } = require("./errors/AppError");

function garantirEmailVerificado(user) {
  if (user && user.emailVerified === false) {
    throw new EmailNaoVerificadoError();
  }
}

module.exports = { garantirEmailVerificado };