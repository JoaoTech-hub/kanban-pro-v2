import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`

*{

margin:0;

padding:0;

box-sizing:border-box;

}

body{

font-family:Inter,Arial,sans-serif;

background:${({theme})=>theme.background};

color:${({theme})=>theme.text};

transition:.25s;

}

button{

cursor:pointer;

font-family:inherit;

}

input,textarea,select{

font-family:inherit;

}

`;

export default GlobalStyle;