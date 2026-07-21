import styled from "styled-components";

export const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-top: 25px;
`;

export const StatCard = styled.div`
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};

  border-radius: 14px;

  padding: 25px;

  box-shadow: 0 5px 15px ${({ theme }) => theme.shadow};

  display: flex;
  flex-direction: column;
  gap: 8px;

  transition: .2s;

  cursor: pointer;

  &:hover{
    transform: translateY(-4px);
  }

  h3{
    margin:0;
    font-size:30px;
  }

  span{
    opacity:.8;
  }
`;