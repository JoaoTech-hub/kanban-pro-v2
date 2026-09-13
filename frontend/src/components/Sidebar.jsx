import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Brandmark from "./UI/Brandmark";

import ProjectSwitcher from "./ProjectSwitcher";
import OrganizationSwitcher from "./OrganizationSwitcher";

import {
  SidebarContainer,
  Logo,
  Menu,
  Item,
  MenuButton,
  Backdrop,
} from "../styles/SidebarStyles";

import {
  FiGrid,
  FiFolder,
  FiClipboard,
  FiUser,
  FiUsers,
  FiMenu,
  FiX,
} from "react-icons/fi";

const itens = [
  { label: "Dashboard", icone: FiGrid, rota: "/dashboard" },
  { label: "Colunas", icone: FiFolder, rota: "/projetos" },
  { label: "Tarefas", icone: FiClipboard, rota: "/tarefas" },
  { label: "Equipe", icone: FiUsers, rota: "/equipe" },
  { label: "Perfil", icone: FiUser, rota: "/perfil" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [aberta, setAberta] = useState(false);

  function irPara(rota) {
    navigate(rota);
    setAberta(false);
  }

  return (
    <>
      <MenuButton
        onClick={() => setAberta((prev) => !prev)}
        aria-label={aberta ? "Fechar menu" : "Abrir menu"}
        aria-expanded={aberta}
      >
        {aberta ? <FiX size={20} /> : <FiMenu size={20} />}
      </MenuButton>

      <Backdrop $visivel={aberta} onClick={() => setAberta(false)} />

      <SidebarContainer $aberta={aberta}>
        <Logo><Brandmark /> Kanban Pro</Logo>

        <OrganizationSwitcher />
        <ProjectSwitcher />

        <Menu>
          {itens.map(({ label, icone: Icone, rota }) => (
            <Item
              key={rota}
              $active={location.pathname === rota}
              onClick={() => irPara(rota)}
            >
              <Icone />
              {label}
            </Item>
          ))}
        </Menu>
      </SidebarContainer>
    </>
  );
}