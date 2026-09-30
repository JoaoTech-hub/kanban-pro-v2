import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useGoogleAuth } from "../hooks/useGoogleAuth";

// GOOGLE_CLIENT_ID é lido de import.meta.env no topo do módulo (fora de
// qualquer componente), então pra testar os dois cenários (configurado /
// não configurado) precisamos reimportar o módulo do zero a cada teste —
// vi.stubEnv muda o valor, vi.resetModules() força a reavaliação do topo do
// arquivo na próxima vez que ele for importado.
vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ dark: false }),
}));
vi.mock("../hooks/useGoogleAuth", () => ({
  useGoogleAuth: vi.fn(),
}));
// @react-oauth/google real precisa de um <GoogleOAuthProvider> real por
// perto (e carregaria o script do Google) — mockamos o GoogleLogin por um
// componente simples que expõe botões pra disparar onSuccess/onError,
// suficiente pra testar a lógica do NOSSO componente.
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: (props) => (
    <div>
      <button onClick={() => props.onSuccess({ credential: "credential-fake-123" })}>
        google-sucesso-com-credential
      </button>
      <button onClick={() => props.onSuccess({})}>google-sucesso-sem-credential</button>
      <button onClick={() => props.onError()}>google-erro</button>
    </div>
  ),
}));

async function importarComponente() {
  vi.resetModules();
  const módulo = await import("../components/GoogleAuthButton");
  return módulo.default;
}

describe("GoogleAuthButton (Etapa 3 — frontend do Google Login)", () => {
  let entrarComGoogle, tratarErroGoogle;

  beforeEach(() => {
    entrarComGoogle = vi.fn().mockResolvedValue(undefined);
    tratarErroGoogle = vi.fn();
    useGoogleAuth.mockReturnValue({ entrarComGoogle, tratarErroGoogle });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("não renderiza nada quando VITE_GOOGLE_CLIENT_ID não está configurado", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const GoogleAuthButton = await importarComponente();

    const { container } = render(<GoogleAuthButton />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renderiza o botão quando VITE_GOOGLE_CLIENT_ID está configurado", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-de-teste");
    const GoogleAuthButton = await importarComponente();

    render(<GoogleAuthButton />);

    expect(screen.getByText("google-sucesso-com-credential")).toBeInTheDocument();
  });

  test("credencial recebida com sucesso chama entrarComGoogle com o ID Token", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-de-teste");
    const GoogleAuthButton = await importarComponente();

    render(<GoogleAuthButton />);
    fireEvent.click(screen.getByText("google-sucesso-com-credential"));

    await waitFor(() => {
      expect(entrarComGoogle).toHaveBeenCalledWith("credential-fake-123");
    });
    expect(tratarErroGoogle).not.toHaveBeenCalled();
  });

  test("sucesso do Google sem credential é tratado como erro (não chama entrarComGoogle)", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-de-teste");
    const GoogleAuthButton = await importarComponente();

    render(<GoogleAuthButton />);
    fireEvent.click(screen.getByText("google-sucesso-sem-credential"));

    expect(tratarErroGoogle).toHaveBeenCalledTimes(1);
    expect(entrarComGoogle).not.toHaveBeenCalled();
  });

  test("erro do próprio Google (onError) chama tratarErroGoogle", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-de-teste");
    const GoogleAuthButton = await importarComponente();

    render(<GoogleAuthButton />);
    fireEvent.click(screen.getByText("google-erro"));

    expect(tratarErroGoogle).toHaveBeenCalledTimes(1);
    expect(entrarComGoogle).not.toHaveBeenCalled();
  });

  test("falha no backend depois da credencial válida é repassada para tratarErroGoogle", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id-de-teste");
    const erroBackend = { response: { data: { erro: "E-mail não verificado pelo Google" } } };
    entrarComGoogle.mockRejectedValueOnce(erroBackend);
    const GoogleAuthButton = await importarComponente();

    render(<GoogleAuthButton />);
    fireEvent.click(screen.getByText("google-sucesso-com-credential"));

    await waitFor(() => {
      expect(tratarErroGoogle).toHaveBeenCalledWith(erroBackend);
    });
  });
});