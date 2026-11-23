import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, ExternalLink, MessageCircle, Send } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty } from "./MvpShell";
import { api, apiError, connectRealtime, formatDate, REASONS, REFERRAL_LABELS, STATUS_LABELS } from "./api";

const TAG_TONE = { pending: "wait", accepted: "ok", completed: "ok", cancelled: "off", declined: "off", expired: "off", no_show: "off" };

export default function StudentArea() {
  const [professionals, setProfessionals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notifications, setNotifications] = useState(undefined);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(null);
  const [reason, setReason] = useState(REASONS[0].code);
  const [note, setNote] = useState("");
  const [meetingMode, setMeetingMode] = useState("online");
  const [appointmentProfessional, setAppointmentProfessional] = useState("");
  const [busy, setBusy] = useState(false);
  const actionBusyRef = useRef(false);
  const [feedback, setFeedback] = useState({});
  const [rescheduleFor, setRescheduleFor] = useState(null);
  const [chatSession, setChatSession] = useState(null);
  const [floatingChatSession, setFloatingChatSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatTyping, setChatTyping] = useState(false);
  const [chatOnline, setChatOnline] = useState(false);
  const [chatRealtimeConnected, setChatRealtimeConnected] = useState(false);
  const [chatReadAt, setChatReadAt] = useState(null);
  const chatSendRef = useRef(null);
  const chatTypingTimerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const chatMessagesRef = useRef(null);
  const chatSessionRef = useRef(null);
  const lastReadSentRef = useRef(null);
  const loadRequestRef = useRef(0);
  const historyControllerRef = useRef(null);
  const updateChatTyping = active => { if (chatTypingTimerRef.current) window.clearTimeout(chatTypingTimerRef.current); chatSendRef.current?.({ type: "typing", active: Boolean(active) }); if (active) chatTypingTimerRef.current = window.setTimeout(() => { chatTypingTimerRef.current = null; chatSendRef.current?.({ type: "typing", active: false }); }, 1800); };

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    try {
      const { data } = await api.get("/students/me/dashboard?summary=1");
      if (requestId !== loadRequestRef.current) return;
      setProfessionals(data.professionals || []);
      setRequests(data.requests || []);
      setAppointmentRequests(data.appointment_requests || []);
      setHistoryLoaded(false);
      setNotifications(data.notifications || []);
      setNotificationUnreadCount(typeof data.notification_unread_count === "number" ? data.notification_unread_count : null);
      setLoadError("");
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(apiError(error));
      throw error;
    } finally { if (requestId === loadRequestRef.current) setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    if (historyLoaded || historyLoading) return;
    historyControllerRef.current?.abort();
    const controller = new AbortController();
    historyControllerRef.current = controller;
    setHistoryLoading(true);
    try {
      const [legacy, direct] = await Promise.all([
        api.get("/students/me/requests?paged=1&limit=50", { signal: controller.signal }),
        api.get("/students/me/appointment-requests", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setRequests(legacy.data?.items || legacy.data || []);
      setAppointmentRequests(direct.data || []);
      setHistoryLoaded(true);
    } catch (error) {
      if (!controller.signal.aborted) toast.error(apiError(error));
    } finally {
      if (historyControllerRef.current === controller) { historyControllerRef.current = null; setHistoryLoading(false); }
    }
  }, [historyLoaded, historyLoading]);

  useEffect(() => () => historyControllerRef.current?.abort(), []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);
  const cancel = async id => {
    if (typeof window !== "undefined" && !window.confirm("Cancelar esta conversa? O horário voltará a ficar disponível.")) return;
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    try {
      await api.post(`/students/me/requests/${id}/cancel`);
      toast("Conversa cancelada. O horário voltou a ficar disponível.");
      await load();
    } catch (e) { toast.error(apiError(e)); }
    finally { actionBusyRef.current = false; }
  };

  const reschedule = async (id, availabilityId) => {
    if (!availabilityId) return;
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    const selected = professionals.flatMap(professional => professional.slots).find(item => item.id === availabilityId);
    const mode = selected?.mode === "presencial" ? "presencial" : "online";
    try { await api.post(`/students/me/requests/${id}/reschedule`, { availability_id: availabilityId, meeting_mode: mode }); toast.success("Novo horário enviado para confirmação."); setRescheduleFor(null); await load(); }
    catch (e) { toast.error(apiError(e)); await load(); }
    finally { actionBusyRef.current = false; }
  };

  const requestDirectAppointment = async () => {
    if (!appointmentProfessional || actionBusyRef.current) return;
    actionBusyRef.current = true;
    setBusy(true);
    try {
      await api.post("/students/me/appointment-requests", { professional_id: appointmentProfessional, meeting_mode: meetingMode, reason_code: reason, note: note || null });
      toast.success("Pedido enviado ao profissional.", { description: "Ele poderá propor uma data e horário para você." });
      setAppointmentProfessional(""); setNote("");
      await load();
    } catch (e) { toast.error(apiError(e)); }
    finally { actionBusyRef.current = false; setBusy(false); }
  };

  const confirmAppointmentProposal = async id => {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    try {
      const { data: session } = await api.post(`/students/me/appointment-requests/${id}/confirm`, {}, { timeout: 30_000 });
      setAppointmentRequests(current => current.map(item => item.id === id ? { ...item, status: "accepted", session } : item));
      toast.success("Horário confirmado.");
    } catch (e) {
      toast.error(apiError(e));
      return;
    } finally { actionBusyRef.current = false; }
    load().catch(() => toast.error("O horário foi confirmado, mas o painel não atualizou. Recarregue a página."));
  };
  const cancelAppointmentRequest = async id => {
    if (typeof window !== "undefined" && !window.confirm("Cancelar este pedido de atendimento?")) return;
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    try { await api.post(`/students/me/appointment-requests/${id}/cancel`); toast("Pedido cancelado."); await load(); }
    catch (e) { toast.error(apiError(e)); }
    finally { actionBusyRef.current = false; }
  };

  const sendFeedback = async sessionId => {
    const entry = feedback[sessionId] || {};
    if (!entry.score || actionBusyRef.current) return;
    actionBusyRef.current = true;
    try {
      await api.post(`/students/me/sessions/${sessionId}/feedback`, { score: entry.score, comment: entry.comment || null });
      toast.success("Obrigado pelo retorno.");
      await load();
    } catch (e) { toast.error(apiError(e)); }
    finally { actionBusyRef.current = false; }
  };

  const openChat = async sessionId => {
    if (chatSession === sessionId) { chatSessionRef.current = null; lastReadSentRef.current = null; setChatSession(null); setChatLoading(false); setChatError(""); setChatDraft(""); setChatOnline(false); setChatTyping(false); setChatReadAt(null); return; }
    setChatMessages([]);
    setChatLoading(true);
    setChatError("");
    setChatDraft("");
    setChatOnline(false);
    setChatTyping(false);
    setChatReadAt(null);
    lastReadSentRef.current = null;
    chatSessionRef.current = sessionId;
    setChatSession(sessionId);
  };
  const openFloatingChat = sessionId => { setFloatingChatSession(sessionId); if (chatSession !== sessionId) openChat(sessionId); };
  const openConversationLauncher = sessionId => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mvp-open-conversation", { detail: sessionId })); };
  const sendChat = async sessionId => {
    const body = chatDraft.trim(); if (!body || chatBusy || chatLoading) return;
    setChatBusy(true);
    try { updateChatTyping(false); const { data } = await api.post(`/students/me/sessions/${sessionId}/messages`, { body }); if (chatSessionRef.current === sessionId) { setChatMessages(current => current.some(message => message.id === data.id) ? current : [...current, data]); setChatDraft(""); } }
    catch (e) { toast.error(apiError(e)); }
    finally { setChatBusy(false); }
  };
  const retryChat = async sessionId => {
    setChatError("");
    setChatLoading(true);
    try { const { data } = await api.get(`/students/me/sessions/${sessionId}/messages`); if (chatSessionRef.current !== sessionId) return; const messages = data || []; setChatMessages(messages); const lastRead = [...messages].reverse().find(message => message.sender_role === "student" && message.read_at); setChatReadAt(lastRead?.read_at || null); }
    catch { if (chatSessionRef.current === sessionId) setChatError("Não foi possível carregar as mensagens."); }
    finally { if (chatSessionRef.current === sessionId) setChatLoading(false); }
  };
  useEffect(() => {
    if (!chatSession) return undefined;
    let active = true;
    const refreshChat = async () => {
      setChatLoading(true);
      try { const { data } = await api.get(`/students/me/sessions/${chatSession}/messages`); if (!active) return; const messages = data || []; setChatMessages(messages); setChatError(""); const lastRead = [...messages].reverse().find(message => message.sender_role === "student" && message.read_at); setChatReadAt(lastRead?.read_at || null); } catch { if (active) { setChatError("Não foi possível carregar as mensagens."); toast.error("Não foi possível carregar as mensagens. Tente novamente."); } } finally { if (active) setChatLoading(false); }
    };
    refreshChat();
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshChat(); };
    const interval = chatRealtimeConnected ? null : setInterval(refreshWhenVisible, 30000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { active = false; if (interval) clearInterval(interval); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [chatSession, chatRealtimeConnected]);
  useEffect(() => {
    if (!chatSession) return undefined;
    setChatRealtimeConnected(false);
    return connectRealtime(chatSession, event => {
      if (event?.type === "message" && event.message) {
        setChatMessages(current => current.some(message => message.id === event.message.id) ? current : [...current, event.message]);
      }
      if (event?.type === "presence") setChatOnline(Boolean(event.online));
      if (event?.type === "typing") setChatTyping(Boolean(event.active));
      if (event?.type === "message_read" && event.messageId) setChatReadAt(event.readAt || new Date().toISOString());
      if (event?.type === "notification") load().catch(() => {});
    }, status => { const connected = status === "open"; setChatRealtimeConnected(connected); if (!connected) { lastReadSentRef.current = null; setChatOnline(false); setChatTyping(false); } }, controls => { chatSendRef.current = controls.send; });
  }, [chatSession, load]);
  useEffect(() => {
    if (!chatSession || !chatMessages.length) return;
    const incoming = [...chatMessages].reverse().find(message => message.sender_role !== "student");
    const readKey = `${chatSession}:${incoming?.id || ""}`;
    if (chatRealtimeConnected && incoming && lastReadSentRef.current !== readKey) { lastReadSentRef.current = readKey; chatSendRef.current?.({ type: "read", messageId: incoming.id }); }
  }, [chatMessages, chatRealtimeConnected, chatSession]);
  useEffect(() => {
    const container = chatMessagesRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [chatMessages.length, chatSession]);

  const upcoming = requests.filter(r => ["pending", "accepted"].includes(r.status));
  const activeAppointmentRequests = appointmentRequests.filter(r => ["pending", "proposed", "accepted"].includes(r.status));
  const hasActiveAppointment = upcoming.length > 0 || activeAppointmentRequests.some(item => item.status !== "accepted" || item.session?.status === "scheduled");
  const history = [...requests.filter(r => !["pending", "accepted"].includes(r.status)), ...appointmentRequests.filter(r => !["pending", "proposed", "accepted"].includes(r.status)).map(r => ({ ...r, date: r.session?.date || r.date, time: r.session?.time || r.time }))];
  const hasJourney = upcoming.length > 0 || history.length > 0;
  const conversations = [...upcoming.filter(request => request.status === "accepted" && request.session).map(request => ({
    id: request.session.id,
    title: request.professional_name || "Profissional",
    subtitle: `${formatDate(request.session.date)} · ${request.session.time}`,
    meta: (notifications || []).some(n => !n.read && n.type === "chat_message_received" && n.meta?.session_id === request.session.id) ? "Nova mensagem" : "Conversa confirmada",
  })), ...appointmentRequests.filter(request => request.status === "accepted" && request.session?.status === "scheduled").map(request => ({
    id: request.session.id,
    title: request.professional_name || "Profissional",
    subtitle: `${formatDate(request.session.date)} · ${request.session.time}`,
    meta: (notifications || []).some(n => !n.read && n.type === "chat_message_received" && n.meta?.session_id === request.session.id) ? "Nova mensagem" : "Conversa confirmada",
  }))];
  const renderFloatingChat = (sessionId, close) => <div className="mvp-floating-chat">{chatError && chatSession === sessionId && <div className="mvp-chat-error" role="alert"><span>{chatError}</span><button type="button" className="button quiet small" onClick={() => retryChat(sessionId)}>Tentar novamente</button></div>}
    <div className="mvp-chat-head"><strong>Chat da conversa</strong><small>{chatOnline ? "Online agora" : "Use para combinar detalhes práticos. O chat é privado entre vocês."}{chatTyping ? " · Digitando…" : ""}</small></div>
    <div className="mvp-chat-messages" ref={chatMessagesRef}>{chatLoading && chatSession === sessionId ? <MvpEmpty>Carregando mensagens…</MvpEmpty> : chatSession === sessionId && chatMessages.length ? chatMessages.map(message => <div className={`mvp-chat-message ${message.sender_role === "student" ? "mine" : "theirs"}`} key={message.id}>{message.body}{message.sender_role === "student" && chatReadAt && <small className="mvp-chat-read">✓✓</small>}</div>) : <MvpEmpty>Nenhuma mensagem ainda. Você pode escrever antes do encontro.</MvpEmpty>}</div>
    <div className="mvp-chat-compose"><input aria-label="Mensagem para a conversa" value={chatSession === sessionId ? chatDraft : ""} maxLength={1000} placeholder="Escreva uma mensagem prática…" onChange={e => { setChatDraft(e.target.value); updateChatTyping(Boolean(e.target.value.trim())); }} onBlur={() => updateChatTyping(false)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(sessionId); } }} /><button type="button" aria-label="Enviar mensagem" className="button small primary" onClick={() => sendChat(sessionId)} disabled={chatBusy || !chatDraft.trim()}><Send size={14} /></button></div>
    <button type="button" className="mvp-floating-chat-close" onClick={() => { chatSessionRef.current = null; setFloatingChatSession(null); setChatSession(null); close(); }}>Fechar conversa</button>
  </div>;
  const flowStep = 0;
  const meetingLabel = mode => mode === "presencial" ? "Presencial · na instituição" : "Online";
  const renderUpcomingConversation = r => <div className={`student-direct-request student-conversation-unified ${r.status === "accepted" ? "is-confirmed" : ""}`} key={r.id} data-testid={`student-request-${r.id}`}>
    <div><strong>{r.professional_name}</strong><span>{r.status === "accepted" ? `Encontro confirmado: ${formatDate(r.session?.date || r.date)} · ${r.session?.time || r.time} · ${meetingLabel(r.meeting_mode)}` : <><CalendarDays size={13} /> {formatDate(r.date)} · {r.time} · {meetingLabel(r.meeting_mode)}</>}</span><small className="mvp-next-step">Próximo passo: {r.next_step}</small></div>
    <div className="mvp-row-actions">
      <span className={`mvp-tag ${TAG_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
      {(r.room_link || r.session?.room_link) && <a className="button small secondary" href={r.room_link || r.session.room_link} target="_blank" rel="noreferrer" data-testid={`room-link-${r.id}`}>Entrar na sala <ExternalLink size={14} /></a>}
      {r.status === "accepted" && r.session && <button type="button" className="button small primary student-chat-action" onClick={() => openConversationLauncher(r.session.id)} data-testid={`open-chat-${r.id}`}><MessageCircle size={14} /> Abrir chat</button>}
      {r.status === "accepted" && !r.room_link && !r.session?.room_link && <span className="student-room-status">Aguardando link da sala</span>}
      {r.status !== "accepted" && <><button type="button" className="button small quiet" onClick={() => setRescheduleFor(rescheduleFor === r.id ? null : r.id)} data-testid={`reschedule-request-${r.id}`}>Trocar horário</button><button type="button" className="button small quiet" onClick={() => cancel(r.id)} data-testid={`cancel-request-${r.id}`}>Cancelar</button></>}
    </div>
    {rescheduleFor === r.id && <div className="mvp-inline-form student-reschedule-form" style={{ marginTop: 10 }}>
      <label>Novo horário<select defaultValue="" onChange={event => reschedule(r.id, event.target.value)} data-testid={`reschedule-select-${r.id}`}><option value="">Escolha um horário disponível</option>{professionals.flatMap(professional => professional.slots.map(item => <option key={item.id} value={item.id}>{professional.name} · {formatDate(item.date)} às {item.time}</option>))}</select></label>
      <small>Ao trocar, o novo horário volta para análise do profissional e só fica confirmado após nova aprovação.</small>
    </div>}
  </div>;

  return (
    <MvpShell
      testid="student-area"
      kicker="Área do estudante"
      title={hasActiveAppointment ? <>{activeAppointmentRequests.some(item => item.status === "accepted") ? <>Sua conversa está <em>confirmada.</em></> : <>Seu atendimento está <em>em andamento.</em></>}</> : <>Um primeiro passo, <em>quando você quiser.</em></>}
      lead={hasActiveAppointment ? (activeAppointmentRequests.some(item => item.status === "accepted") ? "Seu encontro está confirmado. Combine os detalhes práticos pelo chat e aguarde a data marcada." : "Você já tem uma solicitação ou conversa ativa. Novos pedidos ficam disponíveis depois que ela terminar.") : "Envie um pedido para um profissional. Ele vai organizar uma data e horário para vocês. O Acolhe não faz diagnóstico."}
      flow={hasActiveAppointment ? [] : ["Conte o motivo", "Escolha o profissional", "Aguarde a proposta"]}
      flowStep={flowStep}
      collapsePassword
      loading={loading}
      error={loadError}
      onRetry={() => { setLoading(true); return load(); }}
      onRefresh={load}
      conversations={conversations}
      dashboardNotifications={notifications}
      dashboardNotificationUnreadCount={notificationUnreadCount}
      onNotificationsChange={setNotifications}
      onOpenConversation={openFloatingChat}
      renderConversation={renderFloatingChat}
    >
      {hasActiveAppointment ? <MvpCard title="Atendimento em andamento" subtitle="Acompanhe a confirmação, a conversa e os próximos passos por aqui." testid="student-active-appointment-card" className="student-request-card student-active-appointment-card">
        {activeAppointmentRequests.map(item => <div className="student-direct-request" key={item.id}>
          <div><strong>{item.professional_name}</strong><span>{item.status === "proposed" ? `Horário proposto: ${formatDate(item.date)} · ${item.time}` : item.status === "accepted" ? `Encontro confirmado: ${formatDate(item.session?.date || item.date)} · ${item.session?.time || item.time} · ${meetingLabel(item.meeting_mode)}` : "O profissional ainda vai propor uma data e horário."}</span><small className="mvp-next-step">Próximo passo: {item.next_step}</small></div>
          <div className="mvp-row-actions"><span className={`mvp-tag ${item.status === "proposed" ? "wait" : item.status === "accepted" ? "ok" : "pending"}`}>{item.status === "proposed" ? "Proposta recebida" : item.status === "accepted" ? "Confirmada" : "Aguardando profissional"}</span>{item.status === "accepted" && item.session?.room_link && <a className="button small secondary" href={item.session.room_link} target="_blank" rel="noreferrer">Entrar na sala <ExternalLink size={14} /></a>}{item.status === "accepted" && item.session && <button type="button" className="button small primary student-chat-action" onClick={() => openConversationLauncher(item.session.id)}>Abrir chat</button>}{item.status === "proposed" && <button type="button" className="button small primary" onClick={() => confirmAppointmentProposal(item.id)}>Confirmar horário</button>}{item.status !== "accepted" && <button type="button" className="button small quiet" onClick={() => cancelAppointmentRequest(item.id)}>Cancelar</button>}</div>
        </div>)}
        {upcoming.map(renderUpcomingConversation)}
        {upcoming.length > 0 && <p className="student-active-note">Você já tem um encontro marcado. O painel de novos pedidos ficará disponível depois que ele terminar.</p>}
      </MvpCard> : <MvpCard title="Pedir uma conversa" subtitle="Conte o que você precisa. O profissional organiza uma data e horário para vocês." testid="student-direct-request-card" className="student-direct-request-card">
        <div className="mvp-form">
          <label className="student-request-reason">Qual motivo geral descreve melhor o que você busca?
            <select value={reason} onChange={e => setReason(e.target.value)} data-testid="reason-select">
              {REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </label>
          <label className="student-request-note">Quer deixar um recado para o profissional? (opcional)
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Escreva apenas o que ajudar a organizar a conversa." data-testid="reason-note-input" />
          </label>
          <label className="student-request-professional">Profissional
            <select value={appointmentProfessional} onChange={e => setAppointmentProfessional(e.target.value)} data-testid="direct-appointment-professional">
              <option value="">Escolha um profissional</option>
              {professionals.map(item => <option key={item.id} value={item.id}>{item.name}{item.specialty ? ` · ${item.specialty}` : ""}</option>)}
            </select>
          </label>
          <label className="student-request-mode">Formato preferido
            <select value={meetingMode} onChange={e => setMeetingMode(e.target.value)} data-testid="direct-appointment-mode"><option value="online">Online</option><option value="presencial">Presencial · na instituição</option></select>
          </label>
          <small className="student-privacy-note">Este pedido é enviado apenas ao profissional escolhido. A instituição não vê o conteúdo da conversa.</small>
          <button type="button" className="button secondary student-submit" onClick={requestDirectAppointment} disabled={!appointmentProfessional || busy} data-testid="direct-appointment-submit">{busy ? "Enviando…" : "Pedir que o profissional agende"}</button>
        </div>
      </MvpCard>}

      {!hasJourney && <MvpCard title="Sua jornada" subtitle="Aqui aparecerão seus horários marcados e as orientações depois de uma conversa." testid="student-journey-card" className="compact-empty-card">
        <MvpEmpty testid="student-journey-empty">Você ainda não tem uma conversa agendada. Quando enviar um pedido, o profissional organizará os próximos detalhes por aqui.</MvpEmpty>
      </MvpCard>}

      {(history.length > 0 || !historyLoaded) && <details className="mvp-card mvp-collapsible-card student-history-card" data-testid="student-history-card" onToggle={event => { if (event.currentTarget.open) loadHistory(); else historyControllerRef.current?.abort(); }}>
        <summary className="mvp-card-head"><div><h2>Histórico e orientações</h2><p>Depois da conversa, o profissional pode registrar uma orientação.</p></div></summary>
        <div className="mvp-collapsible-body">
        {historyLoading && <MvpEmpty>Carregando histórico…</MvpEmpty>}
        {history.map(r => (
          <div className="mvp-row" key={r.id} style={{ display: "block" }} data-testid={`student-history-${r.id}`}>
            <div className="mvp-row" style={{ borderTop: 0, padding: 0 }}>
              <div className="mvp-row-main">
                <strong>{r.professional_name}</strong>
                <span>{formatDate(r.date)} · {r.time} · {meetingLabel(r.meeting_mode)}</span>
                {r.referral && <span data-testid={`student-referral-${r.id}`}>Orientação: {REFERRAL_LABELS[r.referral.status]}{r.referral.note ? ` — ${r.referral.note}` : ""}</span>}
              </div>
              <span className={`mvp-tag ${TAG_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            {r.status === "completed" && r.session && !r.feedback && (
              <div style={{ marginTop: 12 }} data-testid={`feedback-form-${r.session.id}`}>
                <p style={{ fontSize: 13, opacity: .75, marginBottom: 8 }}>Como foi sua experiência com o Acolhe?</p>
                <small className="mvp-feedback-note">Comentário opcional e operacional; não inclua conteúdo sensível da conversa.</small>
                <div className="mvp-scale">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n}
                      type="button"
                      aria-label={`Nota ${n} de 5`}
                      title={`Nota ${n} de 5`}
                      className={(feedback[r.session.id]?.score === n) ? "selected" : ""}
                      onClick={() => setFeedback(f => ({ ...f, [r.session.id]: { ...f[r.session.id], score: n } }))}
                      data-testid={`feedback-score-${r.session.id}-${n}`}>{n}</button>
                  ))}
                </div>
                <div className="mvp-feedback-scale-labels" aria-hidden="true"><span>Muito ruim</span><span>Excelente</span></div>
                <div className="mvp-form" style={{ marginTop: 10 }}>
                  <textarea aria-label="Comentário opcional sobre a experiência" maxLength={400} placeholder="Quer comentar algo? (opcional)" value={feedback[r.session.id]?.comment || ""}
                    onChange={e => setFeedback(f => ({ ...f, [r.session.id]: { ...f[r.session.id], comment: e.target.value } }))}
                    data-testid={`feedback-comment-${r.session.id}`} />
                  <small className="mvp-feedback-counter">{(feedback[r.session.id]?.comment || "").length}/400</small>
                  <button type="button" className="button secondary" disabled={!feedback[r.session.id]?.score}
                    onClick={() => sendFeedback(r.session.id)} data-testid={`feedback-submit-${r.session.id}`}>Enviar feedback</button>
                </div>
              </div>
            )}
            {r.feedback && <p className="mvp-ok" style={{ marginTop: 10 }} data-testid={`feedback-sent-${r.id}`}>Feedback enviado ({r.feedback.score}/5).</p>}
          </div>
        ))}
        </div>
      </details>}
    </MvpShell>
  );
}
