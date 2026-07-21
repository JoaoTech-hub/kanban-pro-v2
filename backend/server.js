const app = require("./src/app");
const env = require("./src/config/env");

app.listen(env.PORT, () => {
  console.log(`Backend rodando em http://localhost:${env.PORT}`);
});