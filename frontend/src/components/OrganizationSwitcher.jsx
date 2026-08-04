import { useState } from "react";
import { FiChevronDown, FiCheck, FiBriefcase } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";
import {
  Wrapper,
  Trigger,
  TriggerContent,
  Dropdown,
  ProjetoItem,
  ProjetoNome,
} from "../styles/ProjectSwitcherStyles";

// Mesmo padrão visual do ProjectSwitcher (reaproveita os styled-components
// dele — o shell de dropdown é genérico o suficiente pra servir aos dois).
// Fica oculto quando o usuário só pertence a 1 organização, igual ao
// ProjectSwitcher já faz com projeto único.
//
// Não dispara carregar() aqui: o OrganizationsProvider já busca a lista uma
// única vez, perto da raiz do app — este componente só consome o estado
// compartilhado. Antes, como este componente remonta a cada navegação de
// página (a Sidebar vive dentro de PageLayout, montada em cada página),
// chamar carregar() aqui gerava um GET /organizations duplicado a cada troca
// de página.
export default function OrganizationSwitcher() {
  const { organizationId, trocarOrganizacao } = useAuth();
  const { organizacoes } = useOrganizacoes();
  const [aberto, setAberto] = useState(false);

  if (organizacoes.length <= 1) return null;

  const ativa = organizacoes.find((o) => o.id === organizationId);

  function selecionar(id) {
    if (id !== organizationId) trocarOrganizacao(id);
    setAberto(false);
  }

  return (
    <Wrapper>
      <Trigger $aberto={aberto} onClick={() => setAberto((prev) => !prev)}>
        <TriggerContent>
          <FiBriefcase size={16} />
          <span>{ativa?.name || "Selecionar organização"}</span>
        </TriggerContent>
        <FiChevronDown size={16} />
      </Trigger>

      {aberto && (
        <Dropdown>
          {organizacoes.map((org) => (
            <ProjetoItem key={org.id} $ativo={org.id === organizationId} onClick={() => selecionar(org.id)}>
              <ProjetoNome>{org.name}</ProjetoNome>
              {org.id === organizationId && <FiCheck size={16} />}
            </ProjetoItem>
          ))}
        </Dropdown>
      )}
    </Wrapper>
  );
}