const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const requireOrganization = require("../middlewares/requireOrganization");
const { validar, cardSchema, moverCardSchema } = require("../validators/schemas");
const cardsController = require("../controllers/cards.controller");

const router = Router({ mergeParams: true });

const requireProject = require("../middlewares/requireProject");
// ...
router.use(autenticar, requireOrganization, requireProject);

router.get("/", cardsController.listar);
router.post("/", validar(cardSchema), cardsController.criar);
router.patch("/:id", validar(cardSchema), cardsController.atualizar);
router.patch("/:id/mover", validar(moverCardSchema), cardsController.mover);
router.delete("/:id", cardsController.excluir);

module.exports = router;