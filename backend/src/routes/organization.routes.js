const { Router } = require("express");
const { autenticar } = require("../middlewares/auth");
const controller = require("../controllers/organization.controller");

const router = Router();

router.get("/", autenticar, controller.listarMinhas);

module.exports = router;