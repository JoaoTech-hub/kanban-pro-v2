import { useEffect, useRef, useState } from "react";
import { FiBell, FiCheck } from "react-icons/fi";
import styled from "styled-components";
import IconTooltip from "./IconTooltip";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useOrganizationsContext } from "../context/OrganizationsContext";

const Wrapper = styled.div`
  position: relative;
`;

const Trigger = styled.button`
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${({ theme }) => theme.text};
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.column};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.primary};
    outline-offset: 2px;
  }
`;

const Count = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: ${({ theme }) => theme.secondary || theme.primary};
  color: ${({ theme }) => theme.card};
  font-size: 11px;
  line-height: 18px;
  font-weight: 700;
`;

const Panel = styled.section`
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  right: 0;
  width: min(360px, calc(100vw - 32px));
  max-height: 420px;
  overflow: auto;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 8px;
  background: ${({ theme }) => theme.card};
  color: ${({ theme }) => theme.text};
  box-shadow: 0 8px 24px ${({ theme }) => theme.shadow};
`;

const PanelHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  font-size: 14px;
  font-weight: 700;
`;

const TextButton = styled.button`
  border: 0;
  padding: 4px 0;
  background: transparent;
  color: ${({ theme }) => theme.primary};
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  &:disabled { opacity: 0.5; cursor: default; }
`;

const NotificationItem = styled.article`
  display: block;
  padding: 13px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  background: ${({ $unread, theme }) => ($unread ? theme.background : theme.card)};
  &:last-child { border-bottom: 0; }
`;

const Message = styled.p`
  margin: 0 0 5px;
  font-size: 13px;
  line-height: 1.45;
`;

const DateText = styled.time`
  display: block;
  margin-top: 4px;
  color: ${({ theme }) => theme.muted || theme.text};
  opacity: 0.7;
  font-size: 11px;
`;

const ReadButton = styled.button`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.primary};
  cursor: pointer;
`;

const InviteAction = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: ${({ theme }) => theme.primary};
  color: ${({ theme }) => theme.onPrimary || "#fff"};
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  &:disabled { opacity: 0.6; cursor: wait; }
`;

const NotificationActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;

  &:empty { display: none; }
`;

const OrganizationName = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 600;
`;

const Empty = styled.p`
  margin: 0;
  padding: 22px 16px;
  color: ${({ theme }) => theme.text};
  opacity: 0.7;
  text-align: center;
  font-size: 13px;
`;

function formatarData(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptingId, setAcceptingId] = useState(null);
  const wrapperRef = useRef(null);
  const { trocarOrganizacao } = useAuth();
  const { carregar } = useOrganizationsContext();

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let refreshAfterRequest = false;

    async function carregarNotificacoes() {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const { data } = await api.get("/notifications");
        if (!active) return;
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } catch {
        if (active) setError("Não foi possível carregar as notificações.");
      } finally {
        requestInFlight = false;
        if (active) {
          setLoading(false);
          if (refreshAfterRequest) {
            refreshAfterRequest = false;
            carregarNotificacoes();
          }
        }
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (requestInFlight) refreshAfterRequest = true;
        else carregarNotificacoes();
      }
    }

    carregarNotificacoes();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") carregarNotificacoes();
    }, 30_000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function closeOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setError("Não foi possível atualizar a notificação.");
    }
  }

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.readAt ? item : { ...item, readAt }));
      setUnreadCount(0);
    } catch {
      setError("Não foi possível atualizar as notificações.");
    }
  }

  async function acceptInvite(item) {
    setAcceptingId(item.id);
    setError("");
    try {
      const { data } = await api.post(`/notifications/${item.id}/accept-invite`);
      trocarOrganizacao(data.organizationId);
      await carregar();
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((notification) => notification.id === item.id
        ? { ...notification, readAt, invite: { ...notification.invite, acceptedAt: readAt } }
        : notification));
      if (!item.readAt) setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(err.response?.data?.erro || "Não foi possível aceitar o convite.");
    } finally {
      setAcceptingId(null);
    }
  }

  function inviteIsPending(item) {
    return item.type === "invite_received" && item.invite &&
      !item.invite.acceptedAt && !item.invite.revokedAt &&
      new Date(item.invite.expiresAt).getTime() > Date.now();
  }

  return (
    <Wrapper ref={wrapperRef}>
      <IconTooltip label="Notificações">
        <Trigger
          type="button"
          aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ""}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <FiBell size={18} />
          {unreadCount > 0 && <Count aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</Count>}
        </Trigger>
      </IconTooltip>

      {open && (
        <Panel aria-label="Notificações">
          <PanelHeader>
            <span>Notificações</span>
            <TextButton type="button" onClick={markAllRead} disabled={unreadCount === 0}>
              Marcar todas como lidas
            </TextButton>
          </PanelHeader>
          {error && <Empty role="alert">{error}</Empty>}
          {loading ? <Empty>Carregando...</Empty> : notifications.length === 0 ? (
            <Empty>Nenhuma notificação.</Empty>
          ) : notifications.map((item) => (
            <NotificationItem key={item.id} $unread={!item.readAt}>
              <div>
                <Message>{item.message}</Message>
                {item.type === "invite_received" && item.invite?.organization && (
                  <OrganizationName>Organização: {item.invite.organization.name}</OrganizationName>
                )}
                <DateText dateTime={item.createdAt}>{formatarData(item.createdAt)}</DateText>
                <DateText>{item.readAt ? "Lida" : "Não lida"}</DateText>
              </div>
              <NotificationActions>
                {!item.readAt && (
                  <ReadButton type="button" aria-label="Marcar como lida" onClick={() => markRead(item.id)}>
                    <FiCheck size={15} />
                  </ReadButton>
                )}
                {inviteIsPending(item) && (
                  <InviteAction
                    type="button"
                    disabled={acceptingId === item.id}
                    onClick={() => acceptInvite(item)}
                  >
                    {acceptingId === item.id ? "Aceitando..." : "Aceitar convite"}
                  </InviteAction>
                )}
              </NotificationActions>
            </NotificationItem>
          ))}
        </Panel>
      )}
    </Wrapper>
  );
}
