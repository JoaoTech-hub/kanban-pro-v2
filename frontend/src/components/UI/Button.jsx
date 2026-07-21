import styled from "styled-components";

const StyledButton = styled.button`
  border: none;
  border-radius: 10px;

  padding: 12px 18px;

  cursor: pointer;

  font-size: 15px;
  font-weight: 600;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  transition: .2s;

  background: ${({ $danger, $secondary, theme }) => {
    if ($danger) return theme.danger;
    if ($secondary) return "transparent";
    return theme.primary;
  }};

  color: ${({ $secondary, theme }) => ($secondary ? theme.text : "white")};

  border: ${({ $secondary, theme }) =>
    $secondary ? `1.5px solid ${theme.border}` : "none"};

  &:hover{
    transform: translateY(-2px);
    opacity:.9;
  }

  &:disabled {
    opacity: .6;
    cursor: not-allowed;
    transform: none;
  }
`;

export default function Button({
  danger,
  secondary,
  children,
  ...props
}) {
  return (
    <StyledButton $danger={danger} $secondary={secondary} {...props}>
      {children}
    </StyledButton>
  );
}
