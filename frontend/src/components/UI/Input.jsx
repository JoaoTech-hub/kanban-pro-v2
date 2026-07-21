import styled from "styled-components";

const StyledInput = styled.input`
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 15px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }

  &::placeholder {
    opacity: 0.5;
  }
`;

export default StyledInput;
