// Escapa os 5 caracteres com significado especial em HTML. `nome` vem
// diretamente do que o usuário digitou no cadastro (sem sanitização prévia),
// então nunca pode ser interpolado cru num template HTML — do contrário,
// alguém poderia registrar uma conta com um nome contendo tags/scripts que
// seriam renderizados pelo cliente de e-mail de quem recebe este aviso.
function escapeHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderResetSenha({ nome, link }) {
  const assunto = "Redefina sua senha — Kanban Pro";
  const nomeSeguro = escapeHtml(nome);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <body style="font-family: Arial, sans-serif; background:#f4f4f7; padding:32px; margin:0;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
          <h2 style="color:#111827;margin-top:0;">Olá, ${nomeSeguro}</h2>
          <p style="color:#4b5563;font-size:15px;line-height:1.5;">
            Recebemos uma solicitação para redefinir a senha da sua conta no Kanban Pro.
            Se foi você, clique no botão abaixo para continuar.
          </p>
          <p style="text-align:center;margin:32px 0;">
            <a href="${link}"
               style="background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;
                      text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
              Redefinir senha
            </a>
          </p>
          <p style="color:#9ca3af;font-size:13px;line-height:1.5;">
            Este link expira em 1 hora e só pode ser usado uma vez.
            Se você não solicitou essa alteração, pode ignorar este e-mail com segurança —
            sua senha atual continua válida.
          </p>
        </div>
      </body>
    </html>
  `;

  return { assunto, html };
}

module.exports = { renderResetSenha };