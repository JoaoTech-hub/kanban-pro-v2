import { useOrganizationsContext } from "../context/OrganizationsContext";

// Mantido como hook (mesma assinatura/API de antes) para não exigir nenhuma
// mudança nos componentes que já o consomem (Equipe.jsx, OrganizationSwitcher.jsx).
// Por baixo, agora só repassa o estado compartilhado do OrganizationsContext —
// resolve a sincronização entre Sidebar e Equipe sem duplicar lógica.
export function useOrganizacoes() {
  return useOrganizationsContext();
}