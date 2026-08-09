import { useEffect, useState } from "react";
import styled from "styled-components";
import { FiUser, FiLock, FiCheck } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

// ── Styled ────────────────────────────────────────────────────────────────────

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
  max-width: 800px;
`;

const Secao = styled.div`
  background: ${({ theme }) => theme.card};
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const SecaoHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${({ theme }) => theme.text};

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  svg {
    opacity: 0.6;
  }
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.text};
  opacity: 0.75;
`;

const Input = styled.input`
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-size: 15px;
  outline: none;

  &:focus { border-color: ${({ theme }) => theme.primary}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Btn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${({ theme }) => theme.primary};
  color: white;
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.9; }
`;

const Feedback = styled.p`
  margin: 0;
  font-size: 13px;
  text-align: center;
  color: ${({ $erro }) => $erro ? "#ef4444" : "#22c55e"};
  font-weight: 600;
`;

const Avatar = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: ${({ theme }) => theme.primary};
  color: white;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// ── Componente ────────────────────────────────────────────────────────────────

export default function Perfil() {
  const { nome: nomeCtx, atualizarNome: atualizarNomeCtx } = useAuth();

  // Nome já existe no AuthContext — inicializa com ele direto, sem esperar
  // a API, pra evitar o campo aparecer vazio por um instante. O e-mail não
  // existe em nenhum lugar do frontend hoje, então ele sim precisa mesmo
  // da chamada a /perfil.
  const [nome,         setNome]        = useState(nomeCtx || "");
  const [email,        setEmail]       = useState("");
  const [msgNome,      setMsgNome]     = useState(null);
  const [salvandoNome, setSalvandoNome] = useState(false);

  const [senhaAtual,    setSenhaAtual]    = useState("");
  const [novaSenha,     setNovaSenha]     = useState("");
  const [confirmar,     setConfirmar]     = useState("");
  const [msgSenha,      setMsgSenha]      = useState(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    api.get("/perfil").then((r) => {
      // Só sobrescreve o nome se realmente vier diferente — evita um
      // "flash" caso a resposta chegue depois de o usuário já ter
      // começado a digitar algo novo no campo.
      setNome((atual) => (atual === nomeCtx ? r.data.nome : atual));
      setEmail(r.data.email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvarNome(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvandoNome(true);
    setMsgNome(null);
    try {
      await api.patch("/perfil", { nome });
      atualizarNomeCtx(nome);
      setMsgNome({ texto: "Nome atualizado com sucesso!", erro: false });
    } catch (err) {
      setMsgNome({ texto: err.response?.data?.erro || "Erro ao salvar.", erro: true });
    } finally {
      setSalvandoNome(false);
    }
  }

  async function salvarSenha(e) {
    e.preventDefault();
    if (novaSenha !== confirmar) {
      setMsgSenha({ texto: "As senhas não coincidem.", erro: true });
      return;
    }
    if (novaSenha.length < 8 || !/[a-zA-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      setMsgSenha({
        texto: "A senha deve ter pelo menos 8 caracteres, contendo pelo menos uma letra e um número.",
        erro: true,
      });
      return;
    }
    setSalvandoSenha(true);
    setMsgSenha(null);
    try {
      await api.patch("/perfil/senha", { senhaAtual, novaSenha });
      setMsgSenha({ texto: "Senha alterada com sucesso!", erro: false });
      setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
    } catch (err) {
      setMsgSenha({ texto: err.response?.data?.erro || "Erro ao alterar senha.", erro: true });
    } finally {
      setSalvandoSenha(false);
    }
  }

  const inicial = (nome || nomeCtx || "U")[0].toUpperCase();

  return (
    <PageLayout titulo="Perfil" subtitulo="Gerencie suas informações pessoais">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <Avatar>{inicial}</Avatar>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{nome || nomeCtx}</div>
          <div style={{ opacity: 0.5, fontSize: 14 }}>{email}</div>
        </div>
      </div>

      <Grid>
        {/* Seção: dados básicos */}
        <Secao>
          <SecaoHeader>
            <FiUser size={18} />
            <h2>Informações</h2>
          </SecaoHeader>

          <form onSubmit={salvarNome} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Label>
              Nome
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </Label>

            <Label>
              E-mail
              <Input value={email} disabled />
            </Label>

            {msgNome && <Feedback $erro={msgNome.erro}>{msgNome.texto}</Feedback>}

            <Btn type="submit" disabled={salvandoNome}>
              <FiCheck size={16} />
              {salvandoNome ? "Salvando..." : "Salvar nome"}
            </Btn>
          </form>
        </Secao>

        {/* Seção: alterar senha */}
        <Secao>
          <SecaoHeader>
            <FiLock size={18} />
            <h2>Alterar senha</h2>
          </SecaoHeader>

          <form onSubmit={salvarSenha} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Label>
              Senha atual
              <Input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
              />
            </Label>

            <Label>
              Nova senha
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
            </Label>

            <Label>
              Confirmar nova senha
              <Input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
            </Label>

            {msgSenha && <Feedback $erro={msgSenha.erro}>{msgSenha.texto}</Feedback>}

            <Btn type="submit" disabled={salvandoSenha}>
              <FiLock size={16} />
              {salvandoSenha ? "Alterando..." : "Alterar senha"}
            </Btn>
          </form>
        </Secao>
      </Grid>
    </PageLayout>
  );
}