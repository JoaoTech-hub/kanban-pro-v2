const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const controller = require("../controllers/notification.controller");

const router = Router();
router.use(autenticar);
router.get("/", controller.listar);
router.patch("/read-all", controller.marcarTodasComoLidas);
router.post("/:id/accept-invite", controller.aceitarConvite);
router.patch("/:id/read", controller.marcarComoLida);

module.exports = router;
