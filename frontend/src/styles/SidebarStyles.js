import styled from "styled-components";

export const SidebarContainer = styled.aside`
  width: 240px;
  min-height: 100vh;
  background: ${({ theme }) => theme.card};
  box-shadow: 2px 0 15px ${({ theme }) => theme.shadow};
  display: flex;
  flex-direction: column;
  padding: 30px 16px;
  position: sticky;
  top: 0;
  align-self: flex-start;
  z-index: 1000;

  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    transform: translateX(${({ $aberta }) => ($aberta ? "0" : "-100%")});
    transition: transform 0.25s ease;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
  }
`;

export const Logo = styled.h2`
  color: ${({ theme }) => theme.text};
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 40px;
  padding: 0 8px;
`;

export const Menu = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const Item = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
  outline: none;
  padding: 12px 16px;
  border-radius: 10px;
  background: ${({ $active, theme }) => ($active ? theme.primary : "transparent")};
  color: ${({ $active, theme }) => ($active ? "white" : theme.text)};
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? "600" : "500")};
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.15s;
  text-align: left;

  svg {
    font-size: 18px;
    flex-shrink: 0;
  }

  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.primary : theme.background)};
    transform: translateX(4px);
  }
`;

// Botão hamburguer: só aparece em telas pequenas.
export const MenuButton = styled.button`
  display: none;
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1100;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: none;
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  align-items: center;
  justify-content: center;
  cursor: pointer;

  @media (max-width: 768px) {
    display: flex;
  }
`;

// Fundo escurecido atrás do menu quando aberto no mobile.
export const Backdrop = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: ${({ $visivel }) => ($visivel ? "block" : "none")};
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 999;
  }
`;
