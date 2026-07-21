const { ForbiddenError } = require("./errors/AppError");

const PAPEIS_GERENCIAIS = ["owner", "admin"];

// Usado em operações destrutivas/de escrita estrutural (criar, editar, excluir projeto).
// Leitura (listar, buscar) nunca passa por aqui — todo membro pode visualizar.
function garantirPapelGerencial(role) {
  if (!PAPEIS_GERENCIAIS.includes(role)) {
    throw new ForbiddenError("Apenas owner ou admin podem realizar esta ação");
  }
}

module.exports = { garantirPapelGerencial, PAPEIS_GERENCIAIS };