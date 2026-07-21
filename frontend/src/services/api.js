import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Rotas onde um 401 significa um erro de validação do formulário
// (ex: "senha atual incorreta"), não uma sessão expirada — o interceptor
// não deve deslogar o usuário automaticamente nesses casos, só deixar
// o erro seguir pra tela tratar normalmente.
const ROTAS_COM_401_ESPERADO = ["/perfil/senha", "/login"];

// Se o token expirou ou é inválido, o backend responde 401.
// Nesse caso, limpa a sessão local e manda o usuário de volta pro login,
// em vez de deixar a tela travada mostrando erros de requisição.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const rotaAtual = error.config?.url || "";
    const eh401Esperado = ROTAS_COM_401_ESPERADO.some((rota) => rotaAtual.includes(rota));

    if (error.response?.status === 401 && !eh401Esperado) {
      localStorage.removeItem("token");
      localStorage.removeItem("nome");
      localStorage.removeItem("organizationId");
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;