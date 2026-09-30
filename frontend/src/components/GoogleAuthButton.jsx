import { GoogleLogin } from "@react-oauth/google";
import { useTheme } from "../context/ThemeContext";
import { useGoogleAuth } from "../hooks/useGoogleAuth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Renderiza null quando VITE_GOOGLE_CLIENT_ID não está configurado, em vez
// de mostrar um botão do Google que sempre vai falhar — mesmo espírito do
// backend (GOOGLE_CLIENT_ID opcional, Etapa 1): enquanto as credenciais do
// Google Cloud Console não existirem no ambiente, a tela de login/registro
// continua funcionando normalmente só com e-mail/senha.
//
// Esse componente "de fora" não chama nenhum hook antes do guard — de
// propósito. Se useTheme()/useGoogleAuth() fossem chamados aqui, qualquer
// lugar que renderize Login/Registro sem o ThemeProvider do app por perto
// (por exemplo os testes isolados de Login.test.jsx/Registro.test.jsx)
// quebraria mesmo com o Google desligado. Delegar pra um componente interno
// mantém os hooks fora do caminho quando a função está desativada.
export default function GoogleAuthButton({ text = "continue_with" }) {
  if (!GOOGLE_CLIENT_ID) return null;
  return <GoogleAuthButtonAtivo text={text} />;
}

function GoogleAuthButtonAtivo({ text }) {
  const { dark } = useTheme();
  const { entrarComGoogle, tratarErroGoogle } = useGoogleAuth();

  function aoReceberCredencial(credentialResponse) {
    if (!credentialResponse.credential) {
      tratarErroGoogle();
      return;
    }
    entrarComGoogle(credentialResponse.credential).catch(tratarErroGoogle);
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <GoogleLogin
        onSuccess={aoReceberCredencial}
        onError={() => tratarErroGoogle()}
        theme={dark ? "filled_black" : "outline"}
        shape="pill"
        text={text}
        logo_alignment="center"
        width="320"
      />
    </div>
  );
}