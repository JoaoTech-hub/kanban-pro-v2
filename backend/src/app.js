const env = require("./config/env");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const colunasRoutes = require("./routes/colunas.routes");
const cardsRoutes = require("./routes/cards.routes");
const perfilRoutes = require("./routes/perfil.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

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
      // chamadas server-to-server) são sempre permitidas — não representam navegador.
      if (!origin) return callback(null, true);

      // Fora de produção, sem whitelist configurada: libera qualquer origem (conveniência de dev).
      if (env.NODE_ENV !== "production" && origensPermitidas.length === 0) {
        return callback(null, true);
      }

      if (origensPermitidas.includes(origin)) return callback(null, true);

      return callback(new Error("Origem não permitida pelo CORS"));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "OK", sistema: "Kanban API", versao: "1.0" });
});

app.use("/", authRoutes);
app.use("/organizations/:organizationId/projects", projectRoutes);
app.use("/organizations/:organizationId/projects/:projectId/colunas", colunasRoutes);
app.use("/organizations/:organizationId/projects/:projectId/cards", cardsRoutes);
app.use("/perfil", perfilRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

app.use(errorHandler);

module.exports = app;