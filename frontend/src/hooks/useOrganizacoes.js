import { useState, useCallback } from "react";
import api from "../services/api";

// Suporte a multi-org (Feature 6.8): um usuário pode pertencer a mais de
// uma organização (a que criou no registro + qualquer uma pra qual foi
// convidado). Este hook busca essa lista para o seletor de organização.
export function useOrganizacoes() {
  const [organizacoes, setOrganizacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get("/organizations");
      setOrganizacoes(resposta.data || []);
    } catch (e) {
      console.error(e);
      setErro("Não foi possível carregar suas organizações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  return { organizacoes, carregando, erro, carregar };
}