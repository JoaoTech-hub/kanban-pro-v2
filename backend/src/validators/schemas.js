const { z } = require("zod");

const MENSAGEM_ERRO_SENHA =
  "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número.";

const senhaForteSchema = z
  .string({ required_error: "A senha é obrigatória" })
  .min(8, MENSAGEM_ERRO_SENHA)
  .max(200)
  .regex(/[a-zA-Z]/, MENSAGEM_ERRO_SENHA)
  .regex(/[0-9]/, MENSAGEM_ERRO_SENHA);

const registroSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  senha: senhaForteSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

const colunaSchema = z.object({
  nome: z.string().trim().min(1, "O nome da coluna é obrigatório").max(80),
});

const cardSchema = z.object({
  titulo: z.string().trim().min(1, "O título da tarefa é obrigatório").max(150),
  descricao: z.string().max(2000).optional().nullable(),
  prioridade: z.enum(["baixa", "media", "alta"]).optional().default("media"),
  colunaId: z.string().uuid("ID de coluna inválido"),
  prazo: z.string().max(30).optional().nullable(),
});

const moverCardSchema = z.object({
  colunaId: z.string().uuid("ID de coluna inválido"),
  ordem: z.number().int().min(0),
});

const projectSchema = z.object({
  name: z.string().trim().min(1, "Nome do projeto é obrigatório").max(120),
  type: z.enum(["saas", "app", "jogo"]).optional().default("saas"),
});

const projectRenameSchema = z.object({
  name: z.string().trim().min(1, "Nome do projeto é obrigatório").max(120),
});

const perfilSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
});

const senhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: senhaForteSchema,
});

const esqueciSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

const redefinirSenhaSchema = z.object({
  token: z.string().min(10, "Token inválido"),
  novaSenha: senhaForteSchema,
});

// "owner" nunca é um valor aceito vindo do client — conceder owner por
// convite não é suportado (ver shared/authorization.js, garantirPodeAtribuirRole).
const conviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

const alterarRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

// Aceite de convite para quem AINDA NÃO tem conta — cria conta + vínculo
// na mesma operação. Reaproveita a mesma política de senha forte do resto do sistema.
const aceitarConviteContaNovaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  senha: senhaForteSchema,
});

const paginacaoQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      const primeiraMsg = resultado.error.issues[0]?.message || "Dados inválidos";
      return res.status(400).json({ erro: primeiraMsg });
    }
    req.body = resultado.data;
    next();
  };
}

module.exports = {
  registroSchema,
  loginSchema,
  colunaSchema,
  cardSchema,
  moverCardSchema,
  projectSchema,
  projectRenameSchema,
  perfilSchema,
  senhaSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
  paginacaoQuerySchema,
  conviteSchema,
  alterarRoleSchema,
  aceitarConviteContaNovaSchema,
  validar,
};