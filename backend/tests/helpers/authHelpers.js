const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const organizationMemberRepository = require("../../src/repositories/organizationMember.repository");
const userRepository = require("../../src/repositories/user.repository");

function extrairUserIdDoToken(token) {
  const payload = jwt.decode(token);
  return payload.id;
}

async function registrarUsuario(sufixo) {
  const email = `usuario_${sufixo}_${Date.now()}_${Math.random().toString(36).slice(2)}@teste.com`;

  const registro = await request(app).post("/registro").send({
    nome: `Usuario ${sufixo}`,
    email,
    senha: "senha123",
  });

  const userId = extrairUserIdDoToken(registro.body.token);
  await userRepository.updateEmailVerified(userId, true);

  return {
    token: registro.body.token,
    organizationId: registro.body.organizationId,
    email,
  };
}

async function registrarUsuarioNaoVerificado(sufixo) {
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
    userId: extrairUserIdDoToken(registro.body.token),
  };
}

async function adicionarMembro(organizationId, token, role) {
  const userId = extrairUserIdDoToken(token);
  await organizationMemberRepository.create({ organizationId, userId, role });
}

module.exports = {
  registrarUsuario,
  registrarUsuarioNaoVerificado,
  adicionarMembro,
  extrairUserIdDoToken,
};