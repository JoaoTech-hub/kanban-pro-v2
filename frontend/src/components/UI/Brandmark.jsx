import styled from "styled-components";

const Mark = styled.svg`
  width: 1.05em;
  height: 1.05em;
  vertical-align: -0.18em;
  margin-right: 0.32em;
  color: ${({ theme }) => theme.primary};
`;

export default function Brandmark({ className }) {
  return (
    <Mark
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" opacity="0.14" />
      <rect x="5" y="13" width="3.6" height="6" rx="1.3" fill="currentColor" />
      <rect x="10.2" y="8.4" width="3.6" height="10.6" rx="1.3" fill="currentColor" />
      <rect x="15.4" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" />
    </Mark>
  );
}