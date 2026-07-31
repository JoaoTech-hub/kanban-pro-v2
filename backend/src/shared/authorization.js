const { ForbiddenError } = require("./errors/AppError");

const PAPEIS_GERENCIAIS = ["owner", "admin"];

// Usado em operações destrutivas/de escrita estrutural (criar, editar, excluir projeto).
// Leitura (listar, buscar) nunca passa por aqui — todo membro pode visualizar.
function garantirPapelGerencial(role) {
  if (!PAPEIS_GERENCIAIS.includes(role)) {
    throw new ForbiddenError("Apenas owner ou admin podem realizar esta ação");
  }
}

// Só o owner pode convidar/promover alguém a "admin" — um admin não pode
// criar outro admin. Evita escalação lateral de privilégio entre admins
// (um admin comprometido não consegue se multiplicar).
function garantirPodeAtribuirRole(role, roleAlvo) {
  garantirPapelGerencial(role);
  if (roleAlvo === "admin" && role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode conceder o papel de admin");
  }
  if (roleAlvo === "owner") {
    throw new ForbiddenError("Não é possível conceder o papel de owner por este fluxo");
  }
}

// Usado ao alterar o papel de um membro já existente ou removê-lo.
// - O owner nunca pode ser alterado/removido por este fluxo (transferência
//   de ownership é uma feature própria, fora de escopo aqui).
// - Um admin não pode mexer em outro admin — só o owner pode (mesma lógica
//   de "quem pode conceder admin" aplicada também a "quem pode remover/rebaixar admin").
function garantirPodeGerenciarMembro(role, roleAlvo) {
  garantirPapelGerencial(role);
  if (roleAlvo === "owner") {
    throw new ForbiddenError("O owner da organização não pode ser alterado ou removido");
  }
  if (roleAlvo === "admin" && role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode gerenciar administradores");
  }
}

module.exports = {
  garantirPapelGerencial,
  garantirPodeAtribuirRole,
  garantirPodeGerenciarMembro,
  PAPEIS_GERENCIAIS,
};