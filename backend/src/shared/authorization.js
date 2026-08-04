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

// Usado ao sair voluntariamente de uma organização (self-service).
// O owner nunca pode sair sem antes transferir a organização — não existe
// "owner de saída", a organização ficaria sem ninguém no topo. Qualquer
// outro papel (admin ou member) pode sair livremente, mesmo que seja a
// única organização da pessoa — inclusive quando ela já foi owner e
// transferiu a propriedade (nesse caso ela já não é mais owner, é admin,
// e o fato de ter sido owner no passado não é considerado aqui).
//
// Antes havia também um bloqueio de "não pode sair da única organização",
// pra evitar alguém ficar com zero organizações. Essa regra foi removida
// deliberadamente: ela impedia justamente o caso de um ex-owner (agora
// admin) que só pertence à organização que acabou de transferir — forçando
// a pessoa a esperar o novo owner removê-la manualmente, o que não reflete
// a regra de negócio esperada (admin/member sempre podem sair). O estado
// de "zero organizações" continua sendo um caso que o sistema já sabe
// tolerar (mesmo caminho que a remoção por owner/admin, 6.8, já podia gerar).
function garantirPodeSair(role) {
  if (role === "owner") {
    throw new ForbiddenError(
      "Você é o owner desta organização. Transfira a propriedade para outro membro antes de sair."
    );
  }
}

// Só o owner atual pode iniciar uma transferência de ownership — diferente de
// garantirPodeAtribuirRole (que permite ADMIN conceder "member"), aqui não há
// exceção: só quem já é owner decide pra quem passar a organização.
function garantirPodeTransferirOwnership(role) {
  if (role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode transferir a propriedade da organização");
  }
}

// Guarda genérica "só o owner pode" — usada em ações que não são nem
// gerenciamento de membros nem transferência (ex.: renomear a organização).
// Deliberadamente separada de garantirPodeTransferirOwnership: mesma
// checagem de role, mas cada uma carrega a mensagem de erro certa pro
// contexto da própria ação (evita "apenas o owner pode transferir a
// propriedade" aparecer como erro ao tentar só renomear).
function garantirEhOwner(role) {
  if (role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode realizar esta ação");
  }
}

module.exports = {
  garantirPapelGerencial,
  garantirPodeAtribuirRole,
  garantirPodeGerenciarMembro,
  garantirPodeSair,
  garantirPodeTransferirOwnership,
  garantirEhOwner,
  PAPEIS_GERENCIAIS,
};