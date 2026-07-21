// Implementação concreta usando Resend. Isolado propositalmente aqui:
// nenhum outro arquivo do projeto importa "resend" diretamente.
//
// Contrato que todo provider precisa seguir (documentado aqui como referência
// pra quem for criar um novo provider):
//   async function enviar({ to, subject, html }) -> Promise<void>

// Instanciado dentro da função (não no topo do arquivo) para nunca falhar
// só por importar o módulo — só falha de verdade se alguém tentar enviar
// e-mail sem a variável configurada.
async function enviar({ to, subject, html }) {
  const env = require("../../../config/env");
  const { Resend } = require("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  const remetente = env.EMAIL_FROM;
  if (!remetente) {
    throw new Error("EMAIL_FROM não configurado — defina no .env o e-mail remetente.");
  }

  const { error } = await resend.emails.send({
    from: remetente,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail via Resend: ${error.message}`);
  }
}

module.exports = { enviar };