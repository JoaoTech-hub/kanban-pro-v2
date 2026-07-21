const prisma = require("../config/db");
const projectRepository = require("../repositories/project.repository");
const colunaRepository = require("../repositories/coluna.repository");
const organizationRepository = require("../repositories/organization.repository");
const { NotFoundError, PlanLimitError } = require("../shared/errors/AppError");
const { garantirPapelGerencial } = require("../shared/authorization");

const LIMITE_PROJETOS_FREE = 1;

async function criar({ organization, organizationRole, name, type }) {
  garantirPapelGerencial(organizationRole);

  return prisma.$transaction(
    async (tx) => {
      if (organization.plan === "free") {
        // Trava a linha da organização ANTES de contar. Se duas requisições
        // de criação chegarem quase juntas, a segunda fica bloqueada aqui
        // até a primeira terminar (commit ou rollback) — só depois ela
        // repete a contagem, já enxergando o projeto recém-criado. Isso
        // fecha a mesma janela de corrida (checar-depois-agir em dois
        // passos separados) que já tínhamos corrigido no token de reset de
        // senha, só que agora aplicada ao limite do plano gratuito.
        await organizationRepository.lockForUpdate(organization.id, tx);

        const total = await projectRepository.countByOrganization(organization.id, tx);
        if (total >= LIMITE_PROJETOS_FREE) {
          throw new PlanLimitError(
            "Plano gratuito permite apenas 1 projeto. Faça upgrade para o plano Pro para criar mais."
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
    // de concorrência real.
    { timeout: 15000 }
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

  const resultado = await projectRepository.deleteByIdAndOrganization(id, organizationId);
  if (resultado.count === 0) throw new NotFoundError("Projeto não encontrado");
}

async function renomear(id, organizationId, organizationRole, name) {
  garantirPapelGerencial(organizationRole);

  const resultado = await projectRepository.renomear(id, organizationId, name);
  if (resultado.count === 0) throw new NotFoundError("Projeto não encontrado");
}

module.exports = { criar, listar, buscarPorId, remover, renomear };