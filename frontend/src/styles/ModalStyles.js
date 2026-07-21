import styled from "styled-components";

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);

  display: flex;
  justify-content: center;
  align-items: center;

  z-index: 9999;
`;

export const ModalContainer = styled.div`
  width: 500px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;

  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};

  border-radius: 16px;

  padding: 30px;

  box-shadow: 0 20px 60px rgba(0,0,0,.3);

  display: flex;
  flex-direction: column;
  gap: 15px;

  @media (max-width: 480px) {
    padding: 20px;
  }
`;

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;