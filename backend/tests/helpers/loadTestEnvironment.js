const path = require("path");
const dotenv = require("dotenv");

const TEST_ENV_PATH = path.join(__dirname, "..", "..", ".env.test");

function carregarAmbienteTeste() {
  dotenv.config({ path: TEST_ENV_PATH });
}

module.exports = { carregarAmbienteTeste };