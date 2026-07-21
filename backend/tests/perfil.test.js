const request = require("supertest");
const app = require("../src/app");
const { registrarUsuario } = require("./helpers/authHelpers");

describe("Perfil", () => {
  test("401 sem token", async () => {
    const res = await request(app).get("/perfil");
    expect(res.status).toBe(401);
  });

  test("obtém o perfil do usuário autenticado", async () => {
    const usuario = await registrarUsuario("perfilA");

    const res = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(usuario.email.toLowerCase());
    expect(res.body.nome).toBeDefined();
  });

  test("atualiza o nome com sucesso", async () => {
    const usuario = await registrarUsuario("perfilB");

    const res = await request(app)
      .patch("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ nome: "Novo Nome" });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("Novo Nome");

    const confirmacao = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(confirmacao.body.nome).toBe("Novo Nome");
  });

  test("rejeita nome vazio (400)", async () => {
    const usuario = await registrarUsuario("perfilC");

    const res = await request(app)
      .patch("/perfil")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ nome: "" });

    expect(res.status).toBe(400);
  });

  test("altera a senha com sucesso e permite login com a nova senha", async () => {
    const usuario = await registrarUsuario("perfilD");

    const alterar = await request(app)
      .patch("/perfil/senha")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ senhaAtual: "senha123", novaSenha: "novaSenha456" });

    expect(alterar.status).toBe(200);

    const login = await request(app)
      .post("/login")
      .send({ email: usuario.email, senha: "novaSenha456" });

    expect(login.status).toBe(200);
  });

  test("rejeita alteração de senha com senha atual incorreta (401)", async () => {
    const usuario = await registrarUsuario("perfilE");

    const res = await request(app)
      .patch("/perfil/senha")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ senhaAtual: "senhaErrada", novaSenha: "novaSenha456" });

    expect(res.status).toBe(401);
  });  

  test("token antigo é invalidado após troca de senha", async () => {
    const usuario = await registrarUsuario("tokenVersionA");
    const tokenAntigo = usuario.token;

    await request(app)
      .patch("/perfil/senha")
      .set("Authorization", `Bearer ${tokenAntigo}`)
      .send({ senhaAtual: "senha123", novaSenha: "senhaNova456" });

    // O token emitido ANTES da troca não deve mais funcionar
    const tentativaComTokenAntigo = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${tokenAntigo}`);

    expect(tentativaComTokenAntigo.status).toBe(401);

    // Login com a senha nova gera um token novo, que deve funcionar normalmente
    const novoLogin = await request(app)
      .post("/login")
      .send({ email: usuario.email, senha: "senhaNova456" });

    const comTokenNovo = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${novoLogin.body.token}`);

    expect(comTokenNovo.status).toBe(200);  
  });
});