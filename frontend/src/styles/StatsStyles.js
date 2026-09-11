import styled from "styled-components";

export const StatsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
`;

export const StatCard = styled.div`
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};

  border-radius: 8px;

  padding: 8px 14px;

  box-shadow: 0 1px 2px ${({ theme }) => theme.shadow};

  display: flex;
  align-items: center;
  gap: 8px;

  transition: box-shadow 0.15s;

  cursor: default;

  &:hover{
    box-shadow: 0 2px 6px ${({ theme }) => theme.shadow};
  }

  svg{
    opacity: .55;
    flex-shrink: 0;
  }

  h3{
    margin:0;
    font-size:15px;
    font-weight: 700;
  }

  span{
    opacity:.65;
    font-size: 13px;
    white-space: nowrap;
  }
`;