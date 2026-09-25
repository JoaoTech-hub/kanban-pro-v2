const env = require("../../config/env");
const resendProvider = require("./providers/resendProvider");
const { renderResetSenha } = require("./templates/resetSenha");
const { renderConvite } = require("./templates/convite");
const { renderVerificacaoEmail } = require("./templates/verificacaoEmail");

const PROVIDERS = {
  resend: resendProvider,
};

function obterProvider() {
  const provider = PROVIDERS[env.EMAIL_PROVIDER];
  if (!provider) {
    throw new Error(
      `Provider de e-mail "${env.EMAIL_PROVIDER}" não está registrado em emailService.js`
    );
  }
  return provider;
}

async function enviarResetSenha({ to, nome, link }) {
  const { assunto, html } = renderResetSenha({ nome, link });
  const provider = obterProvider();
  await provider.enviar({ to, subject: assunto, html });
}

async function enviarConvite({ to, nomeOrganizacao, nomeConvidante, link }) {
  const { assunto, html } = renderConvite({ nomeOrganizacao, nomeConvidante, link });
  const provider = obterProvider();
  await provider.enviar({ to, subject: assunto, html });
}

async function enviarVerificacaoEmail({ to, nome, link }) {
  const { assunto, html } = renderVerificacaoEmail({ nome, link });
  const provider = obterProvider();
  await provider.enviar({ to, subject: assunto, html });
}

module.exports = { enviarResetSenha, enviarConvite, enviarVerificacaoEmail };