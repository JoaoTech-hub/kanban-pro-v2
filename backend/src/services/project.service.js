const prisma = require("../config/db");
const projectRepository = require("../repositories/project.repository");
const colunaRepository = require("../repositories/coluna.repository");
const organizationRepository = require("../repositories/organization.repository");
const { NotFoundError, PlanLimitError, ConflictError } = require("../shared/errors/AppError");
const { garantirPapelGerencial } = require("../shared/authorization");
const { limiteProjetos } = require("../shared/planLimits");

async function criar({ organization, organizationRole, name, type }) {
  garantirPapelGerencial(organizationRole);

  return prisma.$transaction(
    async (tx) => {
      const limite = limiteProjetos(organization.plan);

      // Plano sem teto (hoje, o Pro): pula lock/contagem inteiramente — não
      // existe invariante nenhuma pra proteger aqui.
      if (Number.isFinite(limite)) {
        // Trava a linha da organização ANTES de contar. Se duas requisições
        // de criação chegarem quase juntas, a segunda fica bloqueada aqui
        // até a primeira terminar (commit ou rollback) — só depois ela
        // repete a contagem, já enxergando o projeto recém-criado. Isso
        // fecha a mesma janela de corrida (checar-depois-agir em dois
        // passos separados) que já tínhamos corrigido no token de reset de
        // senha, só que agora aplicada ao limite do plano.
        await organizationRepository.lockForUpdate(organization.id, tx);

        const total = await projectRepository.countByOrganization(organization.id, tx);
        if (total >= limite) {
          throw new PlanLimitError(
            `Você atingiu o limite de ${limite} projetos do plano atual. Faça upgrade para o plano Pro para criar mais.`
          );
        }
      }

      const project = await projectRepository.create(
        { organizationId: organization.id, name, type },
        tx
      );
      await colunaRepository.createDefaults(
        { organizationId: organization.id, projectId: project.id },
        tx
      );
      return project;
    },
    // Mesmo risco identificado em auth.service.js: o padrão do Prisma
    // (5000ms) pode não ser suficiente com um Postgres serverless (Neon),
    // que às vezes precisa "acordar" a instância antes da primeira query.
    // Também dá margem para o tempo de espera pela trava de linha em caso
    // de concorrência real. maxWait (tempo pra conseguir um slot e começar
    // a transação — default 2000ms se omitido) sofre do mesmo problema, e
    // foi a causa raiz confirmada de um P2028 real em teste.
    { timeout: 15000, maxWait: 10000 }
  );
}

// Leitura paginada: qualquer membro da organização pode listar e visualizar, sem checagem de role.
async function listar(organizationId, { pagina = 1, limite = 20 } = {}) {
  const skip = (pagina - 1) * limite;
  const take = limite;

  const { total, projetos } = await projectRepository.findAllByOrganization(organizationId, {
    skip,
    take,
  });

  const totalPaginas = Math.ceil(total / limite) || 1;

  return {
    dados: projetos,
    meta: {
      total,
      pagina,
      limite,
      totalPaginas,
    },
  };
}

async function buscarPorId(id, organizationId) {
  const project = await projectRepository.findByIdAndOrganization(id, organizationId);
  if (!project) throw new NotFoundError("Projeto não encontrado");
  return project;
}

async function remover(id, organizationId, organizationRole) {
  garantirPapelGerencial(organizationRole);

  return prisma.$transaction(
    async (tx) => {
      // Trava a organização ANTES de contar/decidir — evita que duas
      // exclusões concorrentes (de quadros diferentes) leiam a mesma
      // contagem "restam 2" ao mesmo tempo e as duas passem, zerando a
      // organização. A segunda fica bloqueada até a primeira terminar.
      await organizationRepository.lockForUpdate(organizationId, tx);

      const alvo = await projectRepository.findByIdAndOrganization(id, organizationId, tx);
      if (!alvo) throw new NotFoundError("Projeto não encontrado");

      const total = await projectRepository.countByOrganization(organizationId, tx);
      if (total <= 1) {
        // Regra única para qualquer plano, independente do teto de criação
        // (limiteProjetos): nunca se pode ficar sem nenhum quadro. Isso só
        // impede excluir quando resta exatamente 1 — em qualquer plano que
        // já tenha mais de 1 quadro, a exclusão é permitida normalmente.
        throw new ConflictError("Não é possível excluir o último quadro da organização.");
      }

      const resultado = await projectRepository.deleteByIdAndOrganization(
        id,
        organizationId,
        tx
      );
      if (resultado.count === 0) throw new NotFoundError("Projeto não encontrado");
    },
    { timeout: 15000, maxWait: 10000 }
  );
}

async function renomear(id, organizationId, organizationRole, name) {
  garantirPapelGerencial(organizationRole);

  const resultado = await projectRepository.renomear(id, organizationId, name);
  if (resultado.count === 0) throw new NotFoundError("Projeto não encontrado");
}

module.exports = { criar, listar, buscarPorId, remover, renomear };