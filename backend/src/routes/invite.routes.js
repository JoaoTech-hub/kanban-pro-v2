const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, conviteSchema } = require("../validators/schemas");
const { authLimiter } = require("../middlewares/rateLimiter");
const controller = require("../controllers/invite.controller");

const router = Router({ mergeParams: true });

router.use(autenticar, requireOrganization);

router.post("/", authLimiter, validar(conviteSchema), controller.criar);
router.get("/", controller.listarPendentes);
router.delete("/:inviteId", controller.revogar);

module.exports = router;