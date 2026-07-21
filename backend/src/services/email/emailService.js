const env = require("../../config/env");
const resendProvider = require("./providers/resendProvider");
const { renderResetSenha } = require("./templates/resetSenha");

// Registro de providers disponíveis. Trocar de provedor é: (1) criar um
// arquivo em providers/ seguindo o mesmo contrato (enviar({to, subject, html})),
// (2) registrar aqui, (3) mudar EMAIL_PROVIDER no .env. Nenhum outro arquivo
// do projeto precisa mudar.
const PROVIDERS = {
  resend: resendProvider,
  // sendgrid: require("./providers/sendgridProvider"),
  // ses:      require("./providers/sesProvider"),
  // mailgun:  require("./providers/mailgunProvider"),
  // postmark: require("./providers/postmarkProvider"),
  // smtp:     require("./providers/smtpProvider"),
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

// Única função que o resto do app (auth.service.js) conhece.
// Não recebe HTML nem detalhes de provider — só o essencial do domínio.
async function enviarResetSenha({ to, nome, link }) {
  const { assunto, html } = renderResetSenha({ nome, link });
  const provider = obterProvider();
  await provider.enviar({ to, subject: assunto, html });
}

module.exports = { enviarResetSenha };