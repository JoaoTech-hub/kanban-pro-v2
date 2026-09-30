// google-auth-library é mockada por inteiro: nos testes não fazemos nenhuma
// chamada real ao Google (nem faria sentido — não temos um ID Token real
// assinado por eles). O que verificamos aqui é o comportamento do NOSSO
// código a partir do payload que o Google devolveria depois de validar um
// token de verdade: verifyIdToken() vira um jest.fn() controlável por teste,
// via mockGoogleRetorna()/mockGoogleFalha() abaixo.
const mockVerifyIdToken = jest.fn();

jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

// Mesmo padrão de reset-senha.test.js/email-verification.test.js: evita que
// registrarUsuario() (usado aqui só como fixture) dispare uma chamada real
// ao Resend a cada teste — sem isso o console fica poluído com o erro real
// do provedor ("You can only send testing emails to..."), sem nenhum ganho
// pra estes testes (o que importa aqui é só o fluxo do Google).
jest.mock("../src/services/email/emailService", () => ({
  enviarVerificacaoEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app = require("../src/app");
const { registrarUsuario } = require("./helpers/authHelpers");

function payloadGoogle(overrides = {}) {
  const sufixo = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    sub: `google-sub-${sufixo}`,
    email: `google_${sufixo}@teste.com`,
    email_verified: true,
    name: "Usuário Google",
    ...overrides,
  };
}

function mockGoogleRetorna(payload) {
  mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => payload });
}

function mockGoogleFalha(erro = new Error("invalid_token")) {
  mockVerifyIdToken.mockRejectedValueOnce(erro);
}

// googleLoginSchema exige min(10) caracteres — estes helpers geram idTokens
// de teste sempre acima do limite, então nenhum teste é derrubado à toa pela
// validação de schema antes mesmo de chegar no mock do Google.
function idTokenFake(rotulo) {
  return `idtoken-teste-${rotulo}-${Math.random().toString(36).slice(2)}`;
}

describe("Login com Google — POST /auth/google (Etapa 2)", () => {
  beforeEach(() => {
    mockVerifyIdToken.mockReset();
  });

  test("cria uma conta nova quando o e-mail do Google ainda não existe no sistema", async () => {
    const payload = payloadGoogle();
    mockGoogleRetorna(payload);

    const res = await request(app).post("/auth/google").send({ idToken: idTokenFake("conta-nova") });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.organizationId).toBeDefined();
    expect(res.body.emailVerified).toBe(true);
    expect(res.body.nome).toBe(payload.name);
  });

  test("logar de novo com o mesmo googleId reaproveita a mesma conta/organização (não duplica)", async () => {
    const payload = payloadGoogle();

    mockGoogleRetorna(payload);
    const primeira = await request(app).post("/auth/google").send({ idToken: idTokenFake("repeticao-1") });
    expect(primeira.status).toBe(200);

    mockGoogleRetorna(payload); // mesmo sub e mesmo e-mail
    const segunda = await request(app).post("/auth/google").send({ idToken: idTokenFake("repeticao-2") });
    expect(segunda.status).toBe(200);

    expect(segunda.body.organizationId).toBe(primeira.body.organizationId);
  });

  test("vincula a uma conta tradicional já existente com o mesmo e-mail (não bloqueia, não duplica)", async () => {
    const usuario = await registrarUsuario("vinculoGoogle");

    mockGoogleRetorna(payloadGoogle({ email: usuario.email }));
    const res = await request(app).post("/auth/google").send({ idToken: idTokenFake("vinculo") });

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(usuario.organizationId);
  });

  test("depois de vincular pelo Google, o login tradicional (e-mail/senha) continua funcionando", async () => {
    const usuario = await registrarUsuario("vinculoNaoQuebraLoginTradicional");

    mockGoogleRetorna(payloadGoogle({ email: usuario.email }));
    const google = await request(app).post("/auth/google").send({ idToken: idTokenFake("vinculo-login") });
    expect(google.status).toBe(200);

    const loginTradicional = await request(app)
      .post("/login")
      .send({ email: usuario.email, senha: "senha123" });

    expect(loginTradicional.status).toBe(200);
    expect(loginTradicional.body.organizationId).toBe(usuario.organizationId);
  });

  test("rejeita quando o Google reporta email_verified: false (401)", async () => {
    mockGoogleRetorna(payloadGoogle({ email_verified: false }));

    const res = await request(app).post("/auth/google").send({ idToken: idTokenFake("nao-verificado") });

    expect(res.status).toBe(401);
  });

  test("rejeita um idToken inválido/expirado — Google recusa a validação (401)", async () => {
    mockGoogleFalha();

    const res = await request(app).post("/auth/google").send({ idToken: idTokenFake("invalido") });

    expect(res.status).toBe(401);
  });

  test("rejeita corpo sem idToken (400 — validação de schema, nem chega a chamar o Google)", async () => {
    const res = await request(app).post("/auth/google").send({});

    expect(res.status).toBe(400);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  test("rejeita idToken curto demais (400 — validação de schema)", async () => {
    const res = await request(app).post("/auth/google").send({ idToken: "abc" });

    expect(res.status).toBe(400);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  test("a resposta não vaza passwordHash nem googleId", async () => {
    mockGoogleRetorna(payloadGoogle());

    const res = await request(app).post("/auth/google").send({ idToken: idTokenFake("sem-vazamento") });

    expect(res.status).toBe(200);
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.googleId).toBeUndefined();
  });

  describe("GOOGLE_CLIENT_ID não configurado (unit, isolado)", () => {
    test("loginComGoogle falha de forma explícita, sem tentar chamar o Google", async () => {
      const original = process.env.GOOGLE_CLIENT_ID;
      // "" (string vazia) em vez de delete: o dotenv só preserva uma
      // variável que já está definida em process.env — uma chave apagada
      // conta como "ainda não definida" e ele a repõe a partir do .env real
      // assim que env.js roda `dotenv.config()` de novo dentro do
      // isolateModules. Uma string vazia já conta como "definida", então o
      // dotenv não mexe nela, e ela continua falsy (equivalente a ausente)
      // pra checagem `env.GOOGLE_CLIENT_ID ? ... : null` do auth.service.
      process.env.GOOGLE_CLIENT_ID = "";

      try {
        let authServiceIsolado;
        // jest.isolateModules força um require novo, fora do cache padrão do
        // Jest, então env.js e auth.service.js são reavaliados já sem a
        // variável — sem isso, o módulo já cacheado (com googleClient
        // instanciado no boot) mascararia esse cenário.
        jest.isolateModules(() => {
          authServiceIsolado = require("../src/services/auth.service");
        });

        await expect(authServiceIsolado.loginComGoogle({ idToken: idTokenFake("sem-client-id") })).rejects.toThrow(
          /GOOGLE_CLIENT_ID/
        );
        expect(mockVerifyIdToken).not.toHaveBeenCalled();
      } finally {
        // finally: garante a restauração mesmo se a asserção acima falhar,
        // pra não vazar GOOGLE_CLIENT_ID="" pros testes seguintes.
        process.env.GOOGLE_CLIENT_ID = original;
      }
    });
  });
});