import { FiLogOut, FiPlus, FiMoon, FiSun, FiSearch } from "react-icons/fi";
import styled from "styled-components";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

import {
  HeaderContainer,
  Left,
  Title,
  Subtitle,
  Right,
} from "../styles/HeaderStyles";

const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${({ theme }) => theme.background};
  border: 1.5px solid ${({ theme }) => theme.border};
  padding: 10px 15px;
  border-radius: 10px;
  width: 280px;
  max-width: 100%;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: ${({ theme }) => theme.primary};
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.text};
  font-size: 14px;
  width: 100%;

  &::placeholder {
    opacity: 0.5;
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.2s, opacity 0.2s;

  background: ${({ $primary, $ghost, theme }) =>
    $primary ? theme.primary : $ghost ? "transparent" : theme.card};

  color: ${({ $primary, theme }) => ($primary ? "white" : theme.text)};

  border: ${({ $ghost, theme }) => ($ghost ? `1.5px solid ${theme.border}` : "none")};

  &:hover {
    transform: translateY(-2px);
    opacity: 0.9;
  }
`;

export default function Header({ pesquisa, setPesquisa, abrirNovaTarefa }) {
  const { nome, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();

  return (
    <HeaderContainer>
      <Left>
        <Title>Dashboard</Title>
        <Subtitle>Bem-vindo, {nome || "Usuário"}</Subtitle>
      </Left>

      <Right>
        <SearchWrapper>
          <FiSearch style={{ opacity: 0.5, flexShrink: 0 }} />
          <SearchInput
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Pesquisar tarefa..."
          />
        </SearchWrapper>

        <ActionButton $primary onClick={abrirNovaTarefa}>
          <FiPlus />
          Nova tarefa
        </ActionButton>

        <ActionButton
          $ghost
          onClick={toggleTheme}
          title={dark ? "Modo claro" : "Modo escuro"}
          aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {dark ? <FiSun /> : <FiMoon />}
        </ActionButton>

        <ActionButton $ghost onClick={logout} title="Sair" aria-label="Sair da conta">
          <FiLogOut />
        </ActionButton>
      </Right>
    </HeaderContainer>
  );
}
