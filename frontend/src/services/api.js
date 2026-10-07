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

// O middleware JWT marca a resposta com SESSAO_INVALIDA quando o token está
// ausente, inválido, expirado ou revogado. Só esse 401 encerra a sessão;
// 401 de fluxos de negócio segue para a tela que iniciou a requisição.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sessaoInvalida = error.response?.data?.codigo === "SESSAO_INVALIDA";

    if (error.response?.status === 401 && sessaoInvalida) {
      localStorage.removeItem("token");
      localStorage.removeItem("nome");
      localStorage.removeItem("organizationId");
      localStorage.removeItem("emailVerified");
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
