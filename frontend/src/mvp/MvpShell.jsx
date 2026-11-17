import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, LogOut, MessageCircle, ShieldCheck, X } from "lucide-react";
import BrandMark from "../components/BrandMark";
import ThemeToggle from "../components/ThemeToggle";
import { useMvpAuth } from "./AuthMvp";
import { api, apiError, connectRealtime, formatNotificationTime } from "./api";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState } from "react";

const ROLE_LABEL = {
  student: "Estudante",
  professional: "Profissional",
  institution: "Instituição",
  admin: "Administração",
};

export const MvpShell = ({ title, kicker, lead, flow = [], flowStep = 0, children, testid, collapsePassword = false, hideIdentity = false, conversations = [], onOpenConversation, renderConversation, loading = false, error = "", onRetry, onRefresh, dashboardNotifications, dashboardNotificationUnreadCount, onNotificationsChange }) => {
  const { user, institution, signOut } = useMvpAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationError, setNotificationError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(null);
  const [notificationPage, setNotificationPage] = useState({ hasMore: false, before: null, loading: false });
  const [refreshError, setRefreshError] = useState("");
  const knownNotificationIds = useRef(null);
  const pendingReadIds = useRef(new Set());
  const notificationsRef = useRef([]);
  const notificationsOpenRef = useRef(false);
  const notificationRef = useRef(null);
  const realtimeRefreshTimer = useRef(null);
  const realtimeFallbackAt = useRef(0);
  const dashboardNotificationPageLoaded = useRef(false);
  const notificationBeforeRef = useRef(null);
  const rolePath = user?.role === "student" ? "students" : user?.role === "professional" ? "professionals" : user?.role === "institution" ? "institutions" : "admin";
  const notificationPath = user?.role === "admin" ? "/admin/notifications" : `/${rolePath}/me/notifications`;
  const dashboardNotificationsReady = Array.isArray(dashboardNotifications);
  const unreadNotifications = notifications.filter(item => !item.read);
  const displayedUnreadCount = unreadCount === null ? unreadNotifications.length : unreadCount;
  const unreadConversationCount = notifications.filter(item => !item.read && item.type === "chat_message_received" && conversations.some(conversation => conversation.id === item.meta?.session_id)).length;
  const isInstitutionLegacyNotification = item => user?.role === "institution" && ["availability_published", "availability_published_for_request"].includes(item?.type);
  const exit = async () => { await signOut(); navigate("/"); };
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { notificationsOpenRef.current = notificationsOpen; }, [notificationsOpen]);
  const loadNotifications = useCallback(async () => {
    if (!user?.role) return;
    setNotificationsLoading(true);
    try {
      const { data } = await api.get(notificationPath);
      const page = Array.isArray(data) ? { items: data, has_more: false, next_before: null } : data;
      // Keep an optimistic read state while the individual read requests are
      // in flight. This prevents a polling/visibility refresh from restoring
      // a badge that the user has just cleared.
      const next = (page?.items || []).filter(item => !isInstitutionLegacyNotification(item)).map(item => pendingReadIds.current.has(item.id) ? { ...item, read: true } : item);
      const previous = knownNotificationIds.current;
      if (previous && typeof window !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
        next.filter(item => !item.read && !previous.has(item.id)).slice(0, 3).forEach(item => new Notification(`Acolhe · ${item.title}`, { body: item.body, tag: item.id }));
      }
      knownNotificationIds.current = new Set(next.map(item => item.id));
      const previousLoaded = notificationsRef.current;
      const merged = notificationBeforeRef.current
        ? [...next, ...previousLoaded.filter(item => !next.some(entry => entry.id === item.id))]
        : next;
      notificationsRef.current = merged;
      setNotifications(current => {
        if (!notificationBeforeRef.current) return next;
        const currentIds = new Set(next.map(item => item.id));
        return [...next, ...current.filter(item => !currentIds.has(item.id))];
      });
      onNotificationsChange?.(merged);
      notificationBeforeRef.current = page?.next_before || null;
      setNotificationPage({ hasMore: Boolean(page?.has_more), before: notificationBeforeRef.current, loading: false });
      setNotificationsLoading(false);
      const serverUnreadCount = typeof page?.unread_count === "number" ? page.unread_count : null;
      setUnreadCount(serverUnreadCount === null ? null : Math.max(0, serverUnreadCount - pendingReadIds.current.size));
      setNotificationError("");
      return true;
    } catch { setNotificationPage(current => ({ ...current, loading: false })); setNotificationsLoading(false); setNotificationError("Não foi possível atualizar as notificações agora."); return false; }
  }, [notificationPath, onNotificationsChange, user?.role]);
  useEffect(() => {
    if (!dashboardNotificationsReady) return;
    const next = dashboardNotifications.filter(item => !isInstitutionLegacyNotification(item)).map(item => pendingReadIds.current.has(item.id) ? { ...item, read: true } : item);
    knownNotificationIds.current = new Set(next.map(item => item.id));
    setUnreadCount(typeof dashboardNotificationUnreadCount === "number" ? Math.max(0, dashboardNotificationUnreadCount - pendingReadIds.current.size) : null);
    setNotifications(current => {
      if (!notificationPage.before) return next;
      const currentIds = new Set(next.map(item => item.id));
      return [...next, ...current.filter(item => !currentIds.has(item.id))];
    });
    setNotificationsLoading(false);
    setNotificationError("");
  }, [dashboardNotificationUnreadCount, dashboardNotifications, dashboardNotificationsReady, notificationPage.before, user?.role]);
  useEffect(() => {
    if (loading && !dashboardNotificationsReady) setNotificationsLoading(true);
  }, [dashboardNotificationsReady, loading]);
  const loadMoreNotifications = async () => {
    if (!notificationPage.hasMore || notificationPage.loading || !notificationPage.before) return;
    setNotificationPage(current => ({ ...current, loading: true }));
    try {
      const { data } = await api.get(`${notificationPath}?before=${encodeURIComponent(notificationPage.before)}`);
      const page = Array.isArray(data) ? { items: data, has_more: false, next_before: null } : data;
      const next = (page?.items || []).filter(item => !isInstitutionLegacyNotification(item)).map(item => pendingReadIds.current.has(item.id) ? { ...item, read: true } : item);
      const current = notificationsRef.current;
      const merged = [...current, ...next.filter(item => !current.some(existing => existing.id === item.id))];
      notificationsRef.current = merged;
      setNotifications(merged);
      onNotificationsChange?.(merged);
      notificationBeforeRef.current = page?.next_before || null;
      setNotificationPage({ hasMore: Boolean(page?.has_more), before: notificationBeforeRef.current, loading: false });
      if (typeof page?.unread_count === "number") setUnreadCount(Math.max(0, page.unread_count - pendingReadIds.current.size));
      // Older entries become visible in the open panel now, so persist the
      // same read behavior used by the first page and keep the badge honest.
      await markNotificationsRead(next);
    } catch {
      setNotificationPage(current => ({ ...current, loading: false }));
      setNotificationError("Não foi possível carregar mais notificações agora.");
    }
  };
  // Realtime is the primary path. Keep a slow safety refresh so a sleeping
  // tab does not generate a Durable Object request every few seconds.
  useEffect(() => {
    if (dashboardNotificationsReady || onRefresh || loading) return undefined;
    loadNotifications();
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") loadNotifications(); };
    const timer = window.setInterval(refreshWhenVisible, 300_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [dashboardNotificationsReady, loadNotifications, loading, onRefresh]);
  const refreshFromRealtime = useCallback(() => {
    if (!onRefresh || !user?.role) return;
    if (realtimeRefreshTimer.current) window.clearTimeout(realtimeRefreshTimer.current);
    realtimeRefreshTimer.current = window.setTimeout(() => {
      onRefresh().catch(() => setRefreshError("Os dados podem estar desatualizados. Tente atualizar novamente."));
      realtimeRefreshTimer.current = null;
    }, 100);
  }, [onRefresh, user?.role]);
  const refreshAfterRealtimeLoss = useCallback(status => {
    if (status !== "error" && status !== "closed") return;
    const nowMs = Date.now();
    if (nowMs - realtimeFallbackAt.current < 15_000) return;
    realtimeFallbackAt.current = nowMs;
    loadNotifications();
    refreshFromRealtime();
  }, [loadNotifications, refreshFromRealtime]);
  useEffect(() => () => { if (realtimeRefreshTimer.current) window.clearTimeout(realtimeRefreshTimer.current); }, []);
  useEffect(() => {
    if (!user?.id) return undefined;
    return connectRealtime(null, event => {
      if (event?.type === "data_changed") { refreshFromRealtime(); return; }
      if (event?.type === "notifications_changed") { loadNotifications(); refreshFromRealtime(); return; }
      if (event?.type !== "notification" || !event.notification) return;
      if (!isInstitutionLegacyNotification(event.notification)) {
        const current = notificationsRef.current;
        if (!current.some(item => item.id === event.notification.id)) {
          const merged = [event.notification, ...current];
          notificationsRef.current = merged;
          setNotifications(merged);
          // A direct realtime notification is already known to be unread.
          // Keep the server-provided unread badge in sync immediately; the
          // next refresh still reconciles the authoritative count.
          if (!event.notification.read) setUnreadCount(currentCount => currentCount === null ? currentCount : currentCount + 1);
          onNotificationsChange?.(merged);
        }
      }
      refreshFromRealtime();
    }, refreshAfterRealtimeLoss);
  }, [onNotificationsChange, refreshAfterRealtimeLoss, refreshFromRealtime, user?.id]);
  useEffect(() => {
    if (!onRefresh || !user?.role) return undefined;
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") onRefresh().then(() => setRefreshError("")).catch(() => setRefreshError("Os dados podem estar desatualizados. Tente atualizar novamente.")); };
    const timer = window.setInterval(refreshWhenVisible, 300_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [onRefresh, user?.role]);
  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const closeOnOutsideClick = event => { if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false); };
    const closeOnEscape = event => { if (event.key === "Escape") setNotificationsOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [notificationsOpen]);
  const markNotificationsRead = async items => {
    const unread = items.filter(item => !item.read);
    if (!unread.length) return;
    unread.forEach(item => pendingReadIds.current.add(item.id));
    setUnreadCount(current => current === null ? null : Math.max(0, current - unread.length));
    const unreadIds = new Set(unread.map(item => item.id));
    const optimistic = notificationsRef.current.map(item => unreadIds.has(item.id) ? { ...item, read: true } : item);
    notificationsRef.current = optimistic;
    setNotifications(optimistic);
    onNotificationsChange?.(optimistic);
    const batches = [];
    for (let index = 0; index < unread.length; index += 100) batches.push(unread.slice(index, index + 100));
    const results = await Promise.allSettled(batches.map(batch => api.post(`${notificationPath}/read`, { ids: batch.map(item => item.id) })));
    const failed = results.reduce((total, result, index) => total + (result.status === "rejected" ? batches[index].length : 0), 0);
    unread.forEach(item => pendingReadIds.current.delete(item.id));
    if (failed) {
      setNotificationError("Não foi possível salvar a leitura. Tentaremos novamente.");
      // Reconcile with the server; pending ids remain protected until this
      // request completes, so a stale response cannot re-add the badge.
      await loadNotifications();
    }
  };
  const readNotification = async notification => { await markNotificationsRead([notification]); };
  const toggleNotifications = () => {
    const nextOpen = !notificationsOpen;
    notificationsOpenRef.current = nextOpen;
    setNotificationsOpen(nextOpen);
    if (!nextOpen) setNotificationFilter("all");
    if (nextOpen) {
      markNotificationsRead(unreadNotifications);
      if (dashboardNotificationsReady && !dashboardNotificationPageLoaded.current) {
        dashboardNotificationPageLoaded.current = true;
        loadNotifications().then(loaded => { if (loaded && notificationsOpenRef.current) return markNotificationsRead(notificationsRef.current); }).catch(() => {});
      }
    }
  };
  const openConversation = sessionId => {
    markNotificationsRead(notifications.filter(item => item.type === "chat_message_received" && item.meta?.session_id === sessionId));
    onOpenConversation?.(sessionId);
  };
  const handleNotificationClick = notification => {
    setNotificationsOpen(false);
    setNotificationFilter("all");
    if (notification.type === "chat_message_received" && notification.meta?.session_id && conversations.some(conversation => conversation.id === notification.meta.session_id)) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mvp-open-conversation", { detail: notification.meta.session_id }));
      return;
    }
    readNotification(notification);
  };
  const enableBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) { toast.error("Este navegador não oferece notificações."); return; }
    const permission = await Notification.requestPermission();
    if (permission === "granted") toast.success("Notificações do navegador ativadas.");
    else toast("As notificações continuam apenas dentro do site.");
  };
  const notificationCategory = notification => {
    if (notification.type === "chat_message_received") return "messages";
    if (["appointment_request_created", "appointment_request_proposed", "appointment_request_confirmed", "appointment_request_cancelled", "request_created", "request_accepted", "request_declined", "request_cancelled", "request_rescheduled", "request_expired", "request_expiring", "room_link_added"].includes(notification.type)) return "appointments";
    return "updates";
  };
  const filteredNotifications = notificationFilter === "all" ? notifications : notifications.filter(notification => notificationCategory(notification) === notificationFilter);
  const visibleNotifications = filteredNotifications;

  return (
    <div className="mvp-shell" data-testid={testid}>
      <header className="mvp-topbar">
        <div className="mvp-topbar-inner">
          <Link to="/" className="logo mvp-brand" data-testid="mvp-brand-link">
            <span className="logo-mark"><BrandMark size={30} /></span><span>Acolhe</span>
          </Link>
          <div className="mvp-topbar-right">
          <span className="mvp-pill" data-testid="mvp-pilot-badge">Dados do piloto</span>
          <span className="mvp-role" data-testid="mvp-role-badge">{ROLE_LABEL[user?.role]}</span>
          {user?.role && <div className="mvp-notifications" ref={notificationRef}>
            <button className={`mvp-notification-button ${displayedUnreadCount ? "has-unread" : ""}`} type="button" aria-label={`Notificações${displayedUnreadCount ? `, ${displayedUnreadCount} não lidas` : ""}`} aria-expanded={notificationsOpen} aria-controls="mvp-notification-panel" title="Notificações" onClick={toggleNotifications} data-testid="mvp-notifications-button"><Bell size={17} />{displayedUnreadCount > 0 && <span className="mvp-notification-badge">{Math.min(displayedUnreadCount, 9)}{displayedUnreadCount > 9 ? "+" : ""}</span>}</button>
            {notificationsOpen && <div className="mvp-notification-panel is-expanded" id="mvp-notification-panel" role="dialog" aria-labelledby="mvp-notification-title" aria-live="polite" aria-busy={notificationsLoading}>
              <div className="mvp-notification-panel-head"><strong id="mvp-notification-title">Notificações{displayedUnreadCount > 0 ? ` (${displayedUnreadCount})` : ""}</strong><button type="button" className="mvp-notification-close" onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações"><X size={15} /></button></div>
              {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && <button type="button" className="mvp-notification-enable" onClick={enableBrowserNotifications}>Ativar avisos na tela</button>}
              {notificationError && <div className="mvp-notification-error" role="status"><span>{notificationError}</span><button type="button" onClick={loadNotifications}>Tentar novamente</button></div>}
              <div className="mvp-notification-filters" role="tablist" aria-label="Filtrar notificações">{[["all", "Todas"], ["messages", "Mensagens"], ["appointments", "Atendimentos"], ["updates", "Atualizações"]].map(([value, label]) => <button type="button" role="tab" aria-selected={notificationFilter === value} aria-controls="mvp-notification-items" className={notificationFilter === value ? "active" : ""} key={value} onClick={() => setNotificationFilter(value)}>{label}</button>)}</div>
              <div id="mvp-notification-items" role="tabpanel" tabIndex="0" aria-label="Lista de notificações">{notificationsLoading && !notifications.length ? <small className="mvp-notification-empty" role="status" aria-live="polite">Carregando notificações…</small> : visibleNotifications.length ? visibleNotifications.map(notification => <button type="button" className={`mvp-notification-item ${notification.read ? "read" : "unread"}`} key={notification.id} onClick={() => handleNotificationClick(notification)} aria-label={`${notification.title}. ${notification.body}. ${formatNotificationTime(notification.created_at)}${notification.read ? ". Lida" : ". Não lida"}`}><span className="mvp-notification-item-title">{!notification.read && <i className="mvp-notification-unread-dot" aria-hidden="true" />}{notification.title}</span><small>{notification.body}</small><time dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time></button>) : <small className="mvp-notification-empty" role="status">Nenhuma atualização por enquanto.</small>}</div>
              {notificationPage.hasMore && <button type="button" className="mvp-notification-view-all" onClick={loadMoreNotifications} disabled={notificationPage.loading} aria-busy={notificationPage.loading}>{notificationPage.loading ? "Carregando…" : "Carregar notificações mais antigas"}</button>}
            </div>}
          </div>}
          <ThemeToggle />
            <button className="button quiet small" onClick={exit} data-testid="mvp-logout-button">
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mvp-main">
        <div className="mvp-head">
          <div>
            <span className="section-kicker">{kicker}</span>
            <h1>{title}</h1>
            {lead && <p className="mvp-lead">{lead}</p>}
            {flow.length > 0 && <ol className="mvp-flow" aria-label="Etapas deste fluxo">
              {flow.map((step, index) => { const state = index < flowStep ? "done" : index === flowStep ? "current" : ""; return <li key={step} className={state} aria-current={state === "current" ? "step" : undefined}><span>{index + 1}</span>{step}</li>; })}
            </ol>}
          </div>
          {!hideIdentity && user?.role !== "student" && <div className="mvp-identity" data-testid="mvp-identity">
            <strong>{user?.name}</strong>
            <span>{institution?.name || "Rede Acolhe"}</span>
          </div>}
        </div>
        {(notificationError || refreshError) && <div className="mvp-sync-warning" role="status"><span>{notificationError || refreshError}</span><button type="button" onClick={() => { setNotificationError(""); setRefreshError(""); loadNotifications(); onRefresh?.().catch(() => setRefreshError("Ainda não foi possível atualizar os dados.")); }}>Atualizar</button></div>}
        {loading ? <MvpDashboardSkeleton role={user?.role} /> : error ? <MvpLoadError message={error} onRetry={onRetry} /> : <div className="mvp-workspace-content">{children}</div>}
        <PasswordChangeCard collapsed={collapsePassword} />
        {(user?.role === "student" || user?.role === "professional") && <ConversationLauncher conversations={conversations} unreadCount={unreadConversationCount} onOpenConversation={openConversation} renderConversation={renderConversation} />}
        <p className="mvp-foot-note">
          <ShieldCheck size={15} /> MVP do piloto Acolhe · a instituição nunca acessa o conteúdo das conversas.
          Revisão jurídica/LGPD necessária antes de uso com dados reais.
        </p>
      </main>
    </div>
  );
};

function MvpDashboardSkeleton({ role = "student" }) {
  return <div className="mvp-dashboard-skeleton" data-role={role} aria-live="polite" aria-busy="true" aria-label="Carregando dados da área">
    <div className="mvp-skeleton-card mvp-skeleton-primary" aria-hidden="true"><span /><span /><div><i /><i /><i /></div></div>
    <div className="mvp-skeleton-grid" aria-hidden="true"><div className="mvp-skeleton-card"><span /><span /><i /><i /></div><div className="mvp-skeleton-card"><span /><span /><i /><i /></div><div className="mvp-skeleton-card"><span /><span /><i /><i /></div></div>
    <div className="mvp-skeleton-card mvp-skeleton-wide" aria-hidden="true"><span /><span /><i /><i /><i /></div>
  </div>;
}

function MvpLoadError({ message, onRetry }) {
  return <div className="mvp-load-error" role="alert">
    <strong>Não conseguimos carregar seus dados agora.</strong>
    <span>{message || "Tente novamente em alguns instantes."}</span>
    <button type="button" className="button secondary small" onClick={onRetry}>Tentar novamente</button>
  </div>;
}

function ConversationLauncher({ conversations, unreadCount, onOpenConversation, renderConversation }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const launcherRef = useRef(null);
  const selected = conversations.find(item => item.id === selectedId);
  const closeConversation = () => setSelectedId(null);
  useEffect(() => {
    const openRequested = event => {
      const id = event.detail;
      if (!id || !conversations.some(item => item.id === id)) return;
      setOpen(true);
      setSelectedId(id);
      onOpenConversation?.(id);
    };
    window.addEventListener("mvp-open-conversation", openRequested);
    return () => window.removeEventListener("mvp-open-conversation", openRequested);
  }, [conversations, onOpenConversation]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = event => { if (!launcherRef.current?.contains(event.target)) { setOpen(false); setSelectedId(null); } };
    const closeOnEscape = event => { if (event.key === "Escape") { setOpen(false); setSelectedId(null); } };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  return <div ref={launcherRef} className={`mvp-conversation-launcher ${open ? "open" : ""}`}>
    {open && <div className="mvp-conversation-panel" id="mvp-conversation-panel" role="dialog" aria-label="Mensagens" aria-modal="false">
      {selectedId && selected && renderConversation ? <div className="mvp-conversation-window">
        <div className="mvp-conversation-panel-head"><button type="button" className="mvp-conversation-back" onClick={closeConversation} aria-label="Voltar para mensagens">‹</button><div><strong>{selected.title}</strong><small>{selected.subtitle}</small><span className="mvp-conversation-status"><i />Conversa confirmada</span></div><button type="button" className="mvp-conversation-close" onClick={() => { closeConversation(); setOpen(false); }} aria-label="Fechar mensagens"><X size={16} /></button></div>
        {renderConversation(selectedId, closeConversation)}
      </div> : <>
      <div className="mvp-conversation-panel-head">
        <div><strong>Mensagens</strong><small>Conversas confirmadas</small></div>
        <button type="button" className="mvp-conversation-close" onClick={() => setOpen(false)} aria-label="Fechar mensagens"><X size={16} /></button>
      </div>
      {conversations.length ? conversations.map(item => <button type="button" className="mvp-conversation-item" key={item.id} onClick={() => { setSelectedId(item.id); onOpenConversation?.(item.id); }}>
        <span className="mvp-conversation-avatar"><MessageCircle size={16} /></span>
        <span className="mvp-conversation-copy"><strong>{item.title}</strong><small>{item.subtitle}</small><em>{item.meta || "Chat disponível"}</em></span>
        <ChevronRight size={16} />
      </button>) : <p className="mvp-conversation-empty">Nenhuma conversa ativa ainda.</p>}</>}
    </div>}
    {!selectedId && <button type="button" className="mvp-conversation-trigger" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="mvp-conversation-panel" aria-label="Mensagens">
      <MessageCircle size={17} /><span>Mensagens</span>{unreadCount > 0 && <b>{unreadCount > 9 ? "9+" : unreadCount}</b>}
    </button>}
  </div>;
}

function PasswordChangeCard({ collapsed = false }) {
  const [formState, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (formState.new_password !== formState.confirm) { toast.error("As senhas novas não coincidem."); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: formState.current_password, new_password: formState.new_password });
      toast.success("Senha alterada.");
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (error) { toast.error(apiError(error)); }
    finally { setSaving(false); }
  };
  const form = <form className="mvp-inline-form" onSubmit={submit}>
    <label>Senha atual<input type="password" required minLength={8} value={formState.current_password} onChange={e => setForm({ ...formState, current_password: e.target.value })} autoComplete="current-password" data-testid="change-current-password-input" /></label>
    <label>Nova senha<input type="password" required minLength={8} value={formState.new_password} onChange={e => setForm({ ...formState, new_password: e.target.value })} autoComplete="new-password" data-testid="change-new-password-input" /></label>
    <label>Confirmar nova senha<input type="password" required minLength={8} value={formState.confirm} onChange={e => setForm({ ...formState, confirm: e.target.value })} autoComplete="new-password" data-testid="change-confirm-password-input" /></label>
    <button className="button secondary" disabled={saving} data-testid="change-password-button">{saving ? "Salvando…" : "Trocar senha"}</button>
  </form>;
  if (collapsed) return <details className="mvp-security-details" data-testid="password-change-card">
    <summary>Conta e segurança <span>Trocar senha</span></summary>
    <p>Troque a senha padrão ou atual a qualquer momento.</p>
    {form}
  </details>;
  return <MvpCard title="Segurança da conta" subtitle="Troque a senha padrão ou atual a qualquer momento." testid="password-change-card">{form}</MvpCard>;
}

export const MvpCard = ({ title, subtitle, action, children, testid, className = "", id }) => (
  <section id={id} className={`mvp-card ${className}`.trim()} data-testid={testid}>
    <div className="mvp-card-head">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
    {children}
  </section>
);

export const MvpEmpty = ({ children = "Sem dados suficientes ainda.", testid }) => (
  <p className="mvp-empty" data-testid={testid}>{children}</p>
);

export const MvpKpi = ({ label, value, note, testid }) => (
  <article className="mvp-kpi" data-testid={testid}>
    <strong>{value === null || value === undefined ? "—" : value}</strong>
    <span className="mvp-kpi-label">{label}</span>
    {note && <span className="mvp-kpi-note">{note}</span>}
  </article>
);

export default MvpShell;
