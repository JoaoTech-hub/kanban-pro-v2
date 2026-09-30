const authService = require("../services/auth.service");

async function registrar(req, res, next) {
  try {
    const resultado = await authService.registrar(req.body);
    res.json({ mensagem: "Usuário criado com sucesso", ...resultado });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const resultado = await authService.login(req.body);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function loginGoogle(req, res, next) {
  try {
    const resultado = await authService.loginComGoogle(req.body);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function esqueciSenha(req, res, next) {
  try {
    await authService.solicitarResetSenha(req.body.email);
    res.json({ mensagem: "Se o e-mail existir em nossa base, você receberá um link de recuperação." });
  } catch (err) {
    next(err);
  }
}

async function redefinirSenha(req, res, next) {
  try {
    await authService.redefinirSenha(req.body);
    res.json({ mensagem: "Senha redefinida com sucesso." });
  } catch (err) {
    next(err);
  }
}

async function verificarEmail(req, res, next) {
  try {
    await authService.verificarEmail(req.body);
    res.json({ mensagem: "E-mail confirmado com sucesso." });
  } catch (err) {
    next(err);
  }
}

async function reenviarVerificacao(req, res, next) {
  try {
    await authService.reenviarVerificacao(req.usuarioId);
    res.json({ mensagem: "Se sua conta ainda não estiver verificada, um novo e-mail foi enviado." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registrar,
  login,
  loginGoogle,
  esqueciSenha,
  redefinirSenha,
  verificarEmail,
  reenviarVerificacao,
};