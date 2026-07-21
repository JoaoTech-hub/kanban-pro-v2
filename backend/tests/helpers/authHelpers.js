const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const organizationMemberRepository = require("../../src/repositories/organizationMember.repository");

async function registrarUsuario(sufixo) {
  const email = `usuario_${sufixo}_${Date.now()}_${Math.random().toString(36).slice(2)}@teste.com`;

  const registro = await request(app).post("/registro").send({
    nome: `Usuario ${sufixo}`,
    email,
    senha: "senha123",
  });

  return {
    token: registro.body.token,
    organizationId: registro.body.organizationId,
    email,
  };
}

// Decodifica o token (sem verificar assinatura — é só um helper de teste,
// pra extrair o userId e vincular esse usuário a outra organização com um role específico).
function extrairUserIdDoToken(token) {
  const payload = jwt.decode(token);
  return payload.id;
}

// Adiciona um usuário já registrado (via seu próprio token) como membro de OUTRA organização,
// com o role informado. Usado para testar regras de autorização (owner/admin/member).
async function adicionarMembro(organizationId, token, role) {
  const userId = extrairUserIdDoToken(token);
  await organizationMemberRepository.create({ organizationId, userId, role });
}

module.exports = { registrarUsuario, adicionarMembro, extrairUserIdDoToken };