const perfilService = require("../services/perfil.service");

async function obter(req, res, next) {
  try {
    const perfil = await perfilService.obter(req.usuarioId);
    res.json(perfil);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const perfil = await perfilService.atualizarNome(req.usuarioId, req.body.nome);
    res.json({ mensagem: "Perfil atualizado", ...perfil });
  } catch (err) {
    next(err);
  }
}

async function alterarSenha(req, res, next) {
  try {
    await perfilService.alterarSenha(req.usuarioId, req.body.senhaAtual, req.body.novaSenha);
    res.json({ mensagem: "Senha alterada com sucesso" });
  } catch (err) {
    next(err);
  }
}

module.exports = { obter, atualizar, alterarSenha };