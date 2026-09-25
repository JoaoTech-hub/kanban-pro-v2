// Escapa os 5 caracteres com significado especial em HTML — mesmo motivo
// do resetSenha.js: `nome` vem direto do que a pessoa digitou no cadastro.
function escapeHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderVerificacaoEmail({ nome, link }) {
  const assunto = "Confirme seu e-mail — Kanban Pro";
  const nomeSeguro = escapeHtml(nome);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <body style="font-family: Arial, sans-serif; background:#f4f4f7; padding:32px; margin:0;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
          <h2 style="color:#111827;margin-top:0;">Olá, ${nomeSeguro}</h2>
          <p style="color:#4b5563;font-size:15px;line-height:1.5;">
            Falta só um passo para liberar sua conta no Kanban Pro: confirme que este
            é mesmo o seu e-mail clicando no botão abaixo.
          </p>
          <p style="text-align:center;margin:32px 0;">
            <a href="${link}"
               style="background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;
                      text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
              Confirmar e-mail
            </a>
          </p>
          <p style="color:#9ca3af;font-size:13px;line-height:1.5;">
            Este link expira em 24 horas e só pode ser usado uma vez.
            Se você não criou uma conta no Kanban Pro, pode ignorar este e-mail com segurança.
          </p>
        </div>
      </body>
    </html>
  `;

  return { assunto, html };
}

module.exports = { renderVerificacaoEmail };