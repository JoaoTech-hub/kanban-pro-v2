const env = require("./config/env");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth.routes");
const organizationRoutes = require("./routes/organization.routes");
const organizationDetailRoutes = require("./routes/organizationDetail.routes");
const memberRoutes = require("./routes/member.routes");
const inviteRoutes = require("./routes/invite.routes");
const conviteRoutes = require("./routes/convite.routes");
const projectRoutes = require("./routes/project.routes");
const colunasRoutes = require("./routes/colunas.routes");
const cardsRoutes = require("./routes/cards.routes");
const perfilRoutes = require("./routes/perfil.routes");
const errorHandler = require("./middlewares/errorHandler");
const { globalLimiter } = require("./middlewares/rateLimiter");

const app = express();

// Configuração de Trust Proxy para proxies reversos (Render, Vercel, Railway).
// Em produção, confia no primeiro salto do proxy para que o express-rate-limit
// utilize o IP real enviado em X-Forwarded-For.
// Em desenvolvimento, mantém o comportamento padrão.
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

// Whitelist explícita: nenhuma origem é aceita por padrão em produção.
// Em desenvolvimento/teste, sem FRONTEND_URL configurada, libera geral por conveniência local.
const origensPermitidas = (env.FRONTEND_URL || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Requisições sem header Origin (curl, apps mobile, testes via Supertest,
      // chamadas server-to-server) são sempre permitidas.
      if (!origin) return callback(null, true);

      // Fora de produção, sem whitelist configurada: libera qualquer origem.
      if (env.NODE_ENV !== "production" && origensPermitidas.length === 0) {
        return callback(null, true);
      }

      if (origensPermitidas.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origem não permitida pelo CORS"));
    },
  })
);

app.use(express.json());

// Aplica o rate limit global para TODA a API.
// As rotas de autenticação também passarão por aqui e,
// em seguida, pelo limitador específico de autenticação.
app.use(globalLimiter);

// Health Check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    sistema: "Kanban API",
    versao: "1.0",
  });
});

// Rotas
app.use("/", authRoutes);
app.use("/convites", conviteRoutes);
app.use("/organizations", organizationRoutes);
app.use("/organizations/:organizationId", organizationDetailRoutes);
app.use("/organizations/:organizationId/members", memberRoutes);
app.use("/organizations/:organizationId/invites", inviteRoutes);
app.use("/organizations/:organizationId/projects", projectRoutes);
app.use("/organizations/:organizationId/projects/:projectId/colunas", colunasRoutes);
app.use("/organizations/:organizationId/projects/:projectId/cards", cardsRoutes);
app.use("/perfil", perfilRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

// Handler global de erros
app.use(errorHandler);

module.exports = app;