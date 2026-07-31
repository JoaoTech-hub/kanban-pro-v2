const inviteService = require("../services/invite.service");

async function criar(req, res, next) {
  try {
    const { invite, tokenBruto } = await inviteService.criar({
      organization: req.organization,
      organizationRole: req.organizationRole,
      invitedById: req.usuarioId,
      email: req.body.email,
      role: req.body.role,
    });

    // Envio de e-mail acontece fora da transação de criação (já commitada) —
    // uma falha no provedor de e-mail não deve desfazer um convite já válido.
    await inviteService.enviarEmailConvite({
      invite,
      tokenBruto,
      organization: req.organization,
      nomeConvidante: req.user.name,
    });

    res.status(201).json({ id: invite.id, email: invite.email, role: invite.role });
  } catch (err) {
    next(err);
  }
}

async function listarPendentes(req, res, next) {
  try {
    const convites = await inviteService.listarPendentes(req.organization.id);
    res.json(convites);
  } catch (err) {
    next(err);
  }
}

async function revogar(req, res, next) {
  try {
    await inviteService.revogar(req.params.inviteId, req.organization.id, req.organizationRole);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── Rotas públicas (fora de /organizations/:organizationId) ────────────────

async function buscarPorToken(req, res, next) {
  try {
    const dados = await inviteService.buscarPorToken(req.params.token);
    res.json(dados);
  } catch (err) {
    next(err);
  }
}

async function aceitarContaNova(req, res, next) {
  try {
    const resultado = await inviteService.aceitarContaNova(req.params.token, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

// Precisa do middleware `autenticar` (usa req.usuarioId).
async function aceitarContaExistente(req, res, next) {
  try {
    const resultado = await inviteService.aceitarContaExistente(req.params.token, req.usuarioId);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  criar,
  listarPendentes,
  revogar,
  buscarPorToken,
  aceitarContaNova,
  aceitarContaExistente,
};