import styled from "styled-components";

export const HeaderContainer = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  margin-bottom: 0;
  border-radius: 15px;
  background: ${({ theme }) => theme.card};
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  flex-wrap: wrap;
  gap: 16px;

  @media (max-width: 480px) {
    padding: 16px;
  }
`;

export const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const Title = styled.h1`
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: ${({ theme }) => theme.text};

  @media (max-width: 480px) {
    font-size: 20px;
  }
`;

export const Subtitle = styled.span`
  font-size: 13px;
  opacity: 0.6;
  color: ${({ theme }) => theme.text};
`;

export const Right = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    width: 100%;
  }
`;
