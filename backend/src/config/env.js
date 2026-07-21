require("dotenv").config();

const { z } = require("zod");

// Valida process.env uma única vez, na primeira vez que este módulo é importado
// (Node cacheia módulos por caminho — chamadas seguintes reaproveitam o resultado já validado).
// Se algo obrigatório estiver ausente ou malformado, o processo falha AGORA, no boot,
// com mensagem clara — em vez de falhar de forma obscura na primeira requisição real.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL é obrigatória"),
    JWT_SECRET: z.string().min(10, "JWT_SECRET deve ter pelo menos 10 caracteres"),
    FRONTEND_URL: z.string().optional(),
    EMAIL_PROVIDER: z.string().default("resend"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.FRONTEND_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message:
          "FRONTEND_URL é obrigatória em produção — necessária para configurar o CORS com uma whitelist segura, sem fallback aberto.",
      });
    }

    if (data.NODE_ENV === "production" && data.EMAIL_PROVIDER === "resend") {
      if (!data.RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RESEND_API_KEY"],
          message: "RESEND_API_KEY é obrigatória em produção quando EMAIL_PROVIDER=resend.",
        });
      }
      if (!data.EMAIL_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_FROM"],
          message: "EMAIL_FROM é obrigatória em produção quando EMAIL_PROVIDER=resend.",
        });
      }
    }
  });

function validarEnv() {
  const resultado = envSchema.safeParse(process.env);

  if (!resultado.success) {
    console.error("❌ Configuração de ambiente inválida:");
    resultado.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  const data = resultado.data;

  // Fora de produção, um FRONTEND_URL ausente nunca deve virar um link
  // quebrado (ex.: "undefined/redefinir-senha?token=...") silenciosamente —
  // cai num valor padrão que bate com a porta default do Vite.
  if (!data.FRONTEND_URL && data.NODE_ENV !== "production") {
    data.FRONTEND_URL = "http://localhost:5173";
  }

  return data;
}

module.exports = validarEnv();