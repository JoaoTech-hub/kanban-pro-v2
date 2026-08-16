const request = require("supertest");
const app = require("../src/app");
const { limparBanco, prisma } = require("./helpers/resetDb");
const { registrarUsuario, adicionarMembro, extrairUserIdDoToken } = require("./helpers/authHelpers");
const organizationRepository = require("../src/repositories/organization.repository");
const inviteService = require("../src/services/invite.service");

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await limparBanco();
});

// Cria um convite chamando o service diretamente (não a rota HTTP), pra
// obter o `tokenBruto` sem depender do envio de e-mail — a API nunca
// devolve o token bruto na resposta (só o e-mail recebe o link), e é
// assim mesmo em produção. Isso NÃO contorna a regra sendo testada: é só
// a forma de conseguir, no teste, o mesmo token que o convidado receberia
// por e-mail. A checagem de limite de `criar()` continua rodando normalmente
// dentro do service.
async function criarConvite(organizationId, donoToken, email, role = "member") {
  const organization = await organizationRepository.findById(organizationId);
  const { tokenBruto } = await inviteService.criar({
    organization,
    organizationRole: "owner",
    invitedById: extrairUserIdDoToken(donoToken),
    // Este helper chama o service direto, pulando o middleware
    // `validar(conviteSchema)` da rota real (é assim que conseguimos o
    // tokenBruto — a API nunca devolve isso na resposta). Só que esse
    // middleware é quem normalmente normaliza o e-mail com
    // `.trim().toLowerCase()` antes de chegar no service. Sem replicar
    // isso aqui, um e-mail passado com case diferente do que ficou
    // gravado em `User.email` (que sempre passa pelo Zod ao registrar)
    // faz `aceitarContaExistente()` comparar duas grafias do mesmo
    // e-mail e achar que são pessoas diferentes — não é um bug de
    // produção, é o helper montando um estado que a API real nunca
    // produziria.
    email: email.trim().toLowerCase(),
    role,
  });
  return tokenBruto;
}

function aceitarContaNova(tokenBruto, sufixo) {
  return request(app)
    .post(`/convites/${tokenBruto}/aceitar-novo`)
    .send({ nome: `Convidado ${sufixo}`, senha: "senha123" });
}

// Adiciona `quantidade` membros direto no banco (bypassa o fluxo de
// convite), só pra montar rápido um cenário "organização já com N
// membros" sem precisar de N requisições HTTP reais em cada teste.
async function seedMembros(organizationId, quantidade, prefixoEmail) {
  for (let i = 0; i < quantidade; i++) {
    const membro = await registrarUsuario(`${prefixoEmail}${i}`);
    await adicionarMembro(organizationId, membro.token, "member");
  }
}

describe("Limite de membros do plano — aceite de convite", () => {
  test("aceitar convite funciona normalmente bem abaixo do limite (2º membro da organização)", async () => {
    const dono = await registrarUsuario("limitePrimeiroDono");
    const token = await criarConvite(dono.organizationId, dono.token, "primeiro@teste.com");

    const resposta = await aceitarContaNova(token, "Primeiro");

    expect(resposta.status).toBe(201);
    const total = await prisma.organizationMember.count({
      where: { organizationId: dono.organizationId },
    });
    expect(total).toBe(2);
  });

  test(
    "plano Free permite membros até o 10º, e bloqueia o 11º (403) — mesmo convite criado quando havia vaga",
    async () => {
      const dono = await registrarUsuario("limiteDono");
      // dono (1) + 8 seedados = 9 membros, 1 vaga livre antes do teto de 10.
      await seedMembros(dono.organizationId, 8, "limiteSeed");

      // Os 2 convites são criados com a organização ainda tendo 9 membros —
      // nenhuma das 2 chamadas a criar() é bloqueada, porque criar() só
      // conta membros ATUAIS, não convites pendentes. Isso é deliberado:
      // reproduz o cenário real do bug original (dá pra convidar além do
      // limite; o problema só aparece — ou não, sem a correção — na hora
      // de aceitar).
      const tokenI = await criarConvite(dono.organizationId, dono.token, "i_limite@teste.com");
      const tokenJ = await criarConvite(dono.organizationId, dono.token, "j_limite@teste.com");

      const respostaI = await aceitarContaNova(tokenI, "I");
      expect(respostaI.status).toBe(201); // total: 10 — atingiu exatamente o teto

      const totalNoTeto = await prisma.organizationMember.count({
        where: { organizationId: dono.organizationId },
      });
      expect(totalNoTeto).toBe(10);

      const respostaJ = await aceitarContaNova(tokenJ, "J");
      expect(respostaJ.status).toBe(403); // total continua 10 — bloqueado
      expect(respostaJ.body.erro).toMatch(/limite/i);
      expect(respostaJ.body.erro).toMatch(/10 membros/);

      const totalDepois = await prisma.organizationMember.count({
        where: { organizationId: dono.organizationId },
      });
      expect(totalDepois).toBe(10);

      // O convite rejeitado não pode ter sido consumido — a transação
      // inteira (checagem + markAsAcceptedIfValid) precisa ter sido
      // desfeita, senão o convite fica "queimado" sem ninguém ter entrado.
      const conviteJ = await prisma.organizationInvite.findFirst({
        where: { organizationId: dono.organizationId, email: "j_limite@teste.com" },
      });
      expect(conviteJ.acceptedAt).toBeNull();

      // E nenhuma conta deveria ter sido criada pro e-mail rejeitado.
      const usuarioJ = await prisma.user.findUnique({ where: { email: "j_limite@teste.com" } });
      expect(usuarioJ).toBeNull();
    }
  );

  test("duas aceitações concorrentes disputando a última vaga: só uma pode passar (regressão de condição de corrida)", async () => {
    const dono = await registrarUsuario("limiteConcorrenteDono");
    // dono (1) + 8 seedados = 9 membros, 1 vaga livre.
    await seedMembros(dono.organizationId, 8, "limiteConcorrenteSeed");

    const tokenE = await criarConvite(dono.organizationId, dono.token, "e_concorrente@teste.com");
    const tokenF = await criarConvite(dono.organizationId, dono.token, "f_concorrente@teste.com");

    const [respostaE, respostaF] = await Promise.all([
      aceitarContaNova(tokenE, "E"),
      aceitarContaNova(tokenF, "F"),
    ]);

    const statuses = [respostaE.status, respostaF.status].sort();
    expect(statuses).toEqual([201, 403]);

    const rejeitada = respostaE.status === 403 ? respostaE : respostaF;
    expect(rejeitada.body.erro).toMatch(/limite/i);

    const totalMembros = await prisma.organizationMember.count({
      where: { organizationId: dono.organizationId },
    });
    expect(totalMembros).toBe(10);
  });

  test("plano Pro não fica preso ao teto do Free — aceite funciona normalmente além de 10 membros", async () => {
    const dono = await registrarUsuario("limiteProDono");
    await organizationRepository.updatePlan(dono.organizationId, "pro");
    // dono (1) + 10 seedados = 11 membros, já acima do que seria o teto do Free.
    await seedMembros(dono.organizationId, 10, "limiteProSeed");

    const tokenG = await criarConvite(dono.organizationId, dono.token, "g_pro@teste.com");
    const respostaG = await aceitarContaNova(tokenG, "G");

    expect(respostaG.status).toBe(201);

    const totalMembros = await prisma.organizationMember.count({
      where: { organizationId: dono.organizationId },
    });
    expect(totalMembros).toBe(12);
  });

  test("o limite é isolado por organização — organização A no teto não afeta o aceite na organização B", async () => {
    const donoA = await registrarUsuario("limiteIsoladoDonoA");
    const donoB = await registrarUsuario("limiteIsoladoDonoB");

    // dono (1) + 8 seedados = 9 membros, 1 vaga livre — o convite é criado
    // AGORA, enquanto ainda há vaga (mesma lógica dos outros testes: criar()
    // também tem seu próprio limite, então criar depois do teto já cheio
    // bloquearia na criação, não testaria o que queremos aqui).
    await seedMembros(donoA.organizationId, 8, "limiteIsoladoSeedA");
    const tokenA = await criarConvite(donoA.organizationId, donoA.token, "bloqueado_a@teste.com");

    // Um 9º membro (direto no banco, sem passar pelo convite acima) ocupa a
    // última vaga — agora A está no teto (10) na hora de aceitar o convite.
    await seedMembros(donoA.organizationId, 1, "limiteIsoladoSeedAExtra");
    const totalA = await prisma.organizationMember.count({
      where: { organizationId: donoA.organizationId },
    });
    expect(totalA).toBe(10);

    const tentativaA = await aceitarContaNova(tokenA, "BloqueadoA");
    expect(tentativaA.status).toBe(403);

    // B está com só 1 membro (o próprio dono) e não é afetada pelo teto de
    // A — aceita normalmente, bem abaixo do limite dela.
    const tokenB = await criarConvite(donoB.organizationId, donoB.token, "livre_b@teste.com");
    const respostaB = await aceitarContaNova(tokenB, "LivreB");
    expect(respostaB.status).toBe(201);

    const totalB = await prisma.organizationMember.count({
      where: { organizationId: donoB.organizationId },
    });
    expect(totalB).toBe(2);
  });

  test("a checagem também vale para quem já tem conta (fluxo aceitar-existente), não só pra conta nova", async () => {
    const dono = await registrarUsuario("limiteExistenteDono");
    // dono (1) + 8 seedados = 9 membros, 1 vaga livre — convite criado
    // enquanto ainda há vaga, pelo mesmo motivo do teste acima.
    await seedMembros(dono.organizationId, 8, "limiteExistenteSeed");

    // forasteiro já tem conta própria (dono de outra organização), só não é
    // membro da organização de `dono` ainda.
    const forasteiro = await registrarUsuario("limiteExistenteForasteiro");
    const tokenH = await criarConvite(dono.organizationId, dono.token, forasteiro.email);

    // Um 9º membro (direto no banco) ocupa a última vaga antes do forasteiro
    // tentar aceitar — agora a organização está no teto (10).
    await seedMembros(dono.organizationId, 1, "limiteExistenteSeedExtra");
    const totalAntes = await prisma.organizationMember.count({
      where: { organizationId: dono.organizationId },
    });
    expect(totalAntes).toBe(10);

    const resposta = await request(app)
      .post(`/convites/${tokenH}/aceitar-existente`)
      .set("Authorization", `Bearer ${forasteiro.token}`);

    expect(resposta.status).toBe(403);
    expect(resposta.body.erro).toMatch(/limite/i);

    const aindaNaoEhMembro = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dono.organizationId,
          userId: extrairUserIdDoToken(forasteiro.token),
        },
      },
    });
    expect(aindaNaoEhMembro).toBeNull();
  });
});