const bcrypt = require("bcrypt");
const userRepository = require("../repositories/user.repository");
const { NotFoundError, UnauthorizedError } = require("../shared/errors/AppError");

// Traduz "name" (campo do Prisma) para "nome" (nome que o frontend já espera),
// mesma estratégia de tradução na borda que usamos em colunas/cards.
function paraRespostaPublica(user) {
  return { nome: user.name, email: user.email };
}

async function obter(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError("Usuário não encontrado");
  return paraRespostaPublica(user);
}

async function atualizarNome(userId, nome) {
  const user = await userRepository.updateName(userId, nome);
  return paraRespostaPublica(user);
}

async function alterarSenha(userId, senhaAtual, novaSenha) {
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError("Usuário não encontrado");

  const valido = await bcrypt.compare(senhaAtual, user.passwordHash);
  if (!valido) throw new UnauthorizedError("Senha atual incorreta");

  const hash = await bcrypt.hash(novaSenha, 10);
  await userRepository.updatePasswordHash(userId, hash);
}

module.exports = { obter, atualizarNome, alterarSenha };