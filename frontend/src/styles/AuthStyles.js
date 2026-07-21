import styled from "styled-components";

export const PageWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.background};
  padding: 20px;
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 20px 60px ${({ theme }) => theme.shadow};
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (max-width: 480px) {
    padding: 28px 20px;
  }
`;

export const Title = styled.h1`
  margin: 0 0 8px;
  font-size: 28px;
`;

export const Subtitle = styled.p`
  margin: 0;
  opacity: 0.6;
  font-size: 14px;
`;

export const Input = styled.input`
  width: 100%;
  padding: 13px 16px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }
`;

export const SubmitButton = styled.button`
  width: 100%;
  padding: 14px;
  background: ${({ theme }) => theme.primary};
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

export const ErrorMsg = styled.p`
  color: #ef4444;
  font-size: 14px;
  margin: 0;
  text-align: center;
`;

export const SuccessMsg = styled.p`
  color: #16a34a;
  font-size: 14px;
  margin: 0;
  text-align: center;
`;

export const FooterLink = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.text};
  opacity: 0.7;

  a,
  button {
    background: none;
    border: none;
    padding: 0;
    color: ${({ theme }) => theme.primary};
    font-weight: 600;
    cursor: pointer;
    font-size: inherit;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;