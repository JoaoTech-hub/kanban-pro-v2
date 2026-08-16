// Única fonte de verdade dos limites de cada plano. Os services de projeto
// e de membros/convites SÓ leem daqui — nunca hardcodam o número nem fazem
// `if (plan === "free")` espalhado pelo código. Mudar um limite existente,
// ou dar um teto a um recurso que hoje não tem, é mexer só neste arquivo.
//
// `Infinity` não é um número grande arbitrário — é a forma de expressar
// "este plano não tem teto para este recurso", sem precisar de um branch
// especial em cada service perguntando "é Pro?". O código de aplicação só
// faz uma pergunta: "qual é o limite deste plano pra este recurso?" — e
// reage genericamente (bloqueia se atingiu, ignora a checagem se o limite
// for infinito).
const PLAN_LIMITS = {
  free: {
    maxMembers: 10,
    maxProjects: 10,
  },
  pro: {
    maxMembers: Infinity,
    maxProjects: Infinity,
  },
};

// Plano desconhecido (não deveria acontecer — `plan` é validado na criação
// da organização — mas se acontecer, é mais seguro cair nos limites do
// Free do que ficar sem limite nenhum por engano).
function limitesDoPlano(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

function limiteMembros(plan) {
  return limitesDoPlano(plan).maxMembers;
}

function limiteProjetos(plan) {
  return limitesDoPlano(plan).maxProjects;
}

module.exports = { PLAN_LIMITS, limiteMembros, limiteProjetos };