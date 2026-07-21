import styled from "styled-components";

const StyledSelect = styled.select`
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 15px;
  font-family: inherit;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${({ theme }) => theme.primary};
  }
`;

export default StyledSelect;
