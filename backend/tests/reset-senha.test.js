// Simula o serviço de e-mail inteiro — os testes não devem depender de
// internet nem de uma conta real no Resend. Isso também nos dá acesso ao
// "link" que seria enviado por e-mail, pra extrair o token e continuar o fluxo.
jest.mock("../src/services/email/emailService", () => ({
  enviarResetSenha: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app = require("../src/app");
const emailService = require("../src/services/email/emailService");
const { registrarUsuario } = require("./helpers/authHelpers");

function extrairTokenDoLink(link) {
  const url = new URL(link);
  return url.searchParams.get("token");
}

describe("Recuperação de senha", () => {
  beforeEach(() => {
    emailService.enviarResetSenha.mockClear();
  });

  test("solicitar reset chama o serviço de e-mail com o link correto", async () => {
    const usuario = await registrarUsuario("resetA");

    const res = await request(app).post("/esqueci-senha").send({ email: usuario.email });

    expect(res.status).toBe(200);
    expect(emailService.enviarResetSenha).toHaveBeenCalledTimes(1);

    const chamada = emailService.enviarResetSenha.mock.calls[0][0];
    expect(chamada.to).toBe(usuario.email.toLowerCase());
    expect(chamada.link).toContain("/redefinir-senha?token=");
  });

  test("solicitar reset com e-mail inexistente responde 200 sem chamar o e-mail (evita enumeração)", async () => {
    const res = await request(app)
      .post("/esqueci-senha")
      .send({ email: "naoexiste@teste.com" });

    expect(res.status).toBe(200);
    expect(emailService.enviarResetSenha).not.toHaveBeenCalled();
  });

  test("mantém resposta 200 genérica mesmo quando o provedor de e-mail falha, sem vazar detalhes do erro", async () => {
    const usuario = await registrarUsuario("resetFalhaEmail");

    // Simula uma falha real de provedor (ex.: Resend em modo sandbox, como
    // capturado em produção): o erro não pode propagar para a resposta HTTP.
    emailService.enviarResetSenha.mockRejectedValueOnce(
      new Error("Falha ao enviar e-mail via Resend: you can only send testing emails to your own email address (dono@exemplo.com)")
    );

    const res = await request(app).post("/esqueci-senha").send({ email: usuario.email });

    expect(res.status).toBe(200);
    expect(res.body.mensagem).toBe(
      "Se o e-mail existir em nossa base, você receberá um link de recuperação."
    );
    // A resposta não pode conter nenhum vestígio do erro do provedor.
    expect(JSON.stringify(res.body)).not.toMatch(/resend/i);
    expect(JSON.stringify(res.body)).not.toMatch(/dono@exemplo\.com/i);
  });

  test("o link enviado nunca é montado com FRONTEND_URL indefinido (regressão)", async () => {
    const usuario = await registrarUsuario("resetLinkValido");

    await request(app).post("/esqueci-senha").send({ email: usuario.email });

    const link = emailService.enviarResetSenha.mock.calls[0][0].link;

    // Trava especificamente o bug já corrigido: process.env.FRONTEND_URL lido
    // cru (sem passar pelo validador central de env) podia produzir
    // "undefined/redefinir-senha?token=...".
    expect(link).not.toMatch(/^undefined/);
    expect(link).toMatch(/^https?:\/\/.+\/redefinir-senha\?token=.+/);
  });

  test("fluxo completo: solicitar, redefinir e logar com a senha nova", async () => {
    const usuario = await registrarUsuario("resetB");

    await request(app).post("/esqueci-senha").send({ email: usuario.email });

    const link = emailService.enviarResetSenha.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    const redefinir = await request(app)
      .post("/redefinir-senha")
      .send({ token, novaSenha: "senhaNovaReset789" });

    expect(redefinir.status).toBe(200);

    const login = await request(app)
      .post("/login")
      .send({ email: usuario.email, senha: "senhaNovaReset789" });

    expect(login.status).toBe(200);
  });

  test("token de reset não pode ser usado duas vezes", async () => {
    const usuario = await registrarUsuario("resetC");

    await request(app).post("/esqueci-senha").send({ email: usuario.email });
    const link = emailService.enviarResetSenha.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    const primeira = await request(app)
      .post("/redefinir-senha")
      .send({ token, novaSenha: "primeiraTroca123" });
    expect(primeira.status).toBe(200);

    const segunda = await request(app)
      .post("/redefinir-senha")
      .send({ token, novaSenha: "segundaTroca456" });
    expect(segunda.status).toBe(401);
  });

  test("duas requisições concorrentes com o mesmo token (ex.: duplo clique): só uma pode ganhar (regressão)", async () => {
    const usuario = await registrarUsuario("resetConcorrente");

    await request(app).post("/esqueci-senha").send({ email: usuario.email });
    const link = emailService.enviarResetSenha.mock.calls[0][0].link;
    const token = extrairTokenDoLink(link);

    // Dispara as duas requisições "ao mesmo tempo" (sem esperar uma
    // terminar antes de iniciar a outra), como um duplo clique no botão
    // faria — é justamente o cenário que a marcação atômica do token
    // (markAsUsedIfValid) precisa cobrir, e que um simples
    // "findValidByToken + markAsUsed" em dois passos não cobre.
    const [respostaA, respostaB] = await Promise.all([
      request(app).post("/redefinir-senha").send({ token, novaSenha: "senhaConcorrenteA1" }),
      request(app).post("/redefinir-senha").send({ token, novaSenha: "senhaConcorrenteB2" }),
    ]);

    const statuses = [respostaA.status, respostaB.status].sort();
    // Exatamente uma das duas deve ter sido aceita (200) e a outra rejeitada
    // (401) — nunca as duas com sucesso.
    expect(statuses).toEqual([200, 401]);

    // Confirma que só a senha da requisição vencedora ficou valendo.
    const vencedora = respostaA.status === 200 ? "senhaConcorrenteA1" : "senhaConcorrenteB2";
    const loginOk = await request(app)
      .post("/login")
      .send({ email: usuario.email, senha: vencedora });
    expect(loginOk.status).toBe(200);
  });

  test("token inválido/inexistente é rejeitado", async () => {
    const res = await request(app)
      .post("/redefinir-senha")
      .send({ token: "token-forjado-que-nao-existe", novaSenha: "qualquerSenha123" });

    expect(res.status).toBe(401);
  });

  test("redefinir senha invalida tokens JWT antigos (integra com tokenVersion)", async () => {
    const usuario = await registrarUsuario("resetD");
    const tokenAntigo = usuario.token;

    await request(app).post("/esqueci-senha").send({ email: usuario.email });
    const link = emailService.enviarResetSenha.mock.calls[0][0].link;
    const resetToken = extrairTokenDoLink(link);

    await request(app)
      .post("/redefinir-senha")
      .send({ token: resetToken, novaSenha: "outraSenhaNova999" });

    const tentativa = await request(app)
      .get("/perfil")
      .set("Authorization", `Bearer ${tokenAntigo}`);

    expect(tentativa.status).toBe(401);
  });

  test("solicitar novo reset invalida o token anterior", async () => {
    const usuario = await registrarUsuario("resetE");

    await request(app).post("/esqueci-senha").send({ email: usuario.email });
    const linkAntigo = emailService.enviarResetSenha.mock.calls[0][0].link;
    const tokenAntigo = extrairTokenDoLink(linkAntigo);

    await request(app).post("/esqueci-senha").send({ email: usuario.email });

    const tentativaComTokenAntigo = await request(app)
      .post("/redefinir-senha")
      .send({ token: tokenAntigo, novaSenha: "senhaQualquer123" });

    expect(tentativaComTokenAntigo.status).toBe(401);
  });
});