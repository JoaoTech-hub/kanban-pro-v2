// Escapa os 5 caracteres com significado especial em HTML. `nomeOrganizacao`
// e `nomeConvidante` vêm de dados digitados pelo usuário (nome da conta,
// nome do workspace), nunca de uma fonte confiável — mesmo cuidado do
// template de reset de senha, pelo mesmo motivo (evitar HTML/script injetado
// sendo renderizado pelo cliente de e-mail de quem recebe o convite).
function escapeHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderConvite({ nomeOrganizacao, nomeConvidante, link }) {
  const nomeOrganizacaoSeguro = escapeHtml(nomeOrganizacao);
  const nomeConvidanteSeguro = escapeHtml(nomeConvidante);
  const assunto = `${nomeConvidanteSeguro} te convidou para ${nomeOrganizacaoSeguro} — Kanban Pro`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <body style="font-family: Arial, sans-serif; background:#f4f4f7; padding:32px; margin:0;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
          <h2 style="color:#111827;margin-top:0;">Você foi convidado!</h2>
          <p style="color:#4b5563;font-size:15px;line-height:1.5;">
            <strong>${nomeConvidanteSeguro}</strong> convidou você para participar da organização
            <strong>${nomeOrganizacaoSeguro}</strong> no Kanban Pro.
          </p>
          <p style="text-align:center;margin:32px 0;">
            <a href="${link}"
               style="background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;
                      text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
              Aceitar convite
            </a>
          </p>
          <p style="color:#9ca3af;font-size:13px;line-height:1.5;">
            Este link expira em 7 dias e só pode ser usado uma vez.
            Se você não esperava este convite, pode ignorar este e-mail com segurança.
          </p>
        </div>
      </body>
    </html>
  `;

  return { assunto, html };
}

module.exports = { renderConvite };