import { useEffect, useState } from "react";
import styled from "styled-components";
import { FiUserPlus, FiTrash2, FiMail, FiClock } from "react-icons/fi";

import PageLayout from "../components/PageLayout";
import Button from "../components/UI/Button";
import Input from "../components/UI/Input";
import Select from "../components/UI/Select";

import { useAuth } from "../context/AuthContext";
import { useOrganizacoes } from "../hooks/useOrganizacoes";
import { useEquipe } from "../hooks/useEquipe";

const Secao = styled.div`
  background: ${({ theme }) => theme.card};
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadow};
  margin-bottom: 24px;
  max-width: 720px;
`;

const SecaoTitulo = styled.h2`
  margin: 0 0 18px;
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.text};
`;

const FormConvite = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 8px;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const Linha = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid ${({ theme }) => theme.border};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: ${({ theme }) => theme.text};
    font-size: 14px;
  }

  span {
    color: ${({ theme }) => theme.text};
    opacity: 0.6;
    font-size: 13px;
  }
`;

const Acoes = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const RolePill = styled.span`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 3px 10px;
  border-radius: 20px;
  background: ${({ $role, theme }) => ($role === "owner" ? theme.primary : theme.border)};
  color: ${({ $role, theme }) => ($role === "owner" ? "white" : theme.text)};
`;

const VazioMsg = styled.p`
  color: ${({ theme }) => theme.text};
  opacity: 0.55;
  font-size: 14px;
`;

// Só o owner pode conceder/gerenciar o papel "admin" — mesma regra do
// backend (shared/authorization.js), espelhada aqui só pra UI não oferecer
// uma ação que o backend vai recusar de qualquer forma.
function podeGerenciar(meuRole, roleAlvo) {
  if (roleAlvo === "owner") return false;
  if (roleAlvo === "admin" && meuRole !== "owner") return false;
  return meuRole === "owner" || meuRole === "admin";
}

export default function Equipe() {
  const { organizationId } = useAuth();
  const { organizacoes, carregar: carregarOrganizacoes } = useOrganizacoes();
  const {
    membros,
    convites,
    carregando,
    carregar,
    convidar,
    revogarConvite,
    alterarRole,
    removerMembro,
  } = useEquipe(organizationId);

  const [email, setEmail] = useState("");
  const [roleConvite, setRoleConvite] = useState("member");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    carregarOrganizacoes();
  }, [carregarOrganizacoes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const minhaOrganizacao = organizacoes.find((o) => o.id === organizationId);
  const meuRole = minhaOrganizacao?.role;
  const souOwner = meuRole === "owner";
  const souGerencial = meuRole === "owner" || meuRole === "admin";

  async function enviarConvite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setEnviando(true);
    const ok = await convidar(email.trim(), roleConvite);
    setEnviando(false);
    if (ok) {
      setEmail("");
      setRoleConvite("member");
    }
  }

  return (
    <PageLayout titulo="Equipe" subtitulo="Gerencie quem tem acesso a esta organização">
      {souGerencial && (
        <Secao>
          <SecaoTitulo>Convidar novo membro</SecaoTitulo>
          <FormConvite onSubmit={enviarConvite}>
            <Input
              type="email"
              placeholder="E-mail da pessoa a convidar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ flex: 2 }}
            />
            <Select
              value={roleConvite}
              onChange={(e) => setRoleConvite(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="member">Membro</option>
              {/* Só o owner pode convidar como admin — mesma regra do backend. */}
              {souOwner && <option value="admin">Admin</option>}
            </Select>
            <Button type="submit" disabled={enviando}>
              <FiUserPlus />
              {enviando ? "Enviando..." : "Convidar"}
            </Button>
          </FormConvite>
        </Secao>
      )}

      <Secao>
        <SecaoTitulo>Membros ({membros.length})</SecaoTitulo>
        {!carregando && membros.length === 0 && <VazioMsg>Nenhum membro ainda.</VazioMsg>}
        {membros.map((m) => (
          <Linha key={m.userId}>
            <Info>
              <strong>{m.nome}</strong>
              <span>{m.email}</span>
            </Info>
            <Acoes>
              {podeGerenciar(meuRole, m.role) ? (
                <>
                  <Select
                    value={m.role}
                    onChange={(e) => alterarRole(m.userId, e.target.value)}
                    style={{ width: 110 }}
                  >
                    <option value="member">Membro</option>
                    {souOwner && <option value="admin">Admin</option>}
                  </Select>
                  <Button danger secondary onClick={() => removerMembro(m.userId)}>
                    <FiTrash2 />
                  </Button>
                </>
              ) : (
                <RolePill $role={m.role}>{m.role}</RolePill>
              )}
            </Acoes>
          </Linha>
        ))}
      </Secao>

      {souGerencial && (
        <Secao>
          <SecaoTitulo>Convites pendentes ({convites.length})</SecaoTitulo>
          {!carregando && convites.length === 0 && (
            <VazioMsg>Nenhum convite pendente.</VazioMsg>
          )}
          {convites.map((c) => (
            <Linha key={c.id}>
              <Info>
                <strong>
                  <FiMail style={{ verticalAlign: "middle", marginRight: 6 }} />
                  {c.email}
                </strong>
                <span>
                  <FiClock style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Convidado por {c.invitedBy?.name || "—"} · papel: {c.role}
                </span>
              </Info>
              <Acoes>
                <Button danger secondary onClick={() => revogarConvite(c.id)}>
                  Revogar
                </Button>
              </Acoes>
            </Linha>
          ))}
        </Secao>
      )}
    </PageLayout>
  );
}