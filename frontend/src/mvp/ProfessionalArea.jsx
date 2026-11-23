import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Award, Check, ExternalLink, MessageCircle, Send } from "lucide-react";
import { MvpShell, MvpCard, MvpEmpty } from "./MvpShell";
import { api, apiError, connectRealtime, formatDate, scheduledTimeHasStarted, REASONS, REFERRAL_LABELS, STATUS_LABELS } from "./api";

const TIME_OPTIONS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:30"];
const reasonLabel = code => REASONS.find(r => r.code === code)?.label || "Não informado";
const formatBrazilianDateInput = value => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
const parseBrazilianDate = value => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split("/").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
};
const sessionStarted = session => scheduledTimeHasStarted(session?.date, session?.time);
const todayIso = () => new Date().toISOString().slice(0, 10);
const escapeHtml = value => String(value ?? "").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export default function ProfessionalArea() {
  const [requests, setRequests] = useState([]);
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [notifications, setNotifications] = useState(undefined);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [serverRadar, setServerRadar] = useState([]);
  const [professionalMetrics, setProfessionalMetrics] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [certificateEligibility, setCertificateEligibility] = useState({ eligible: false, completed_count: 0, required_count: 5 });
  const [links, setLinks] = useState({});
  const [appointmentCustom, setAppointmentCustom] = useState({});
  const [referrals, setReferrals] = useState({});
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
  const [actionBusy, setActionBusy] = useState(false);
  const actionBusyRef = useRef(false);
  const [chatReadAt, setChatReadAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState({ confirmation: "Olá! Seu horário está confirmado. Até lá, você poderá acompanhar os detalhes da conversa por aqui.", reminder: "Olá! Passando para lembrar nossa conversa agendada. Se precisar, confira o horário e a modalidade no Acolhe.", change: "Olá! Precisamos revisar o horário combinado. Vou propor uma nova opção pelo Acolhe.", room: "Olá! O link da sala está disponível no Acolhe. Se tiver dificuldade para acessar, me avise por aqui.", linkRequest: "Olá! Para facilitar o acesso, poderia atualizar ou confirmar o link da sala da nossa conversa?" });
  const chatMessagesRef = useRef(null);
  const chatSendRef = useRef(null);
  const chatTypingTimerRef = useRef(null);
  const chatSessionRef = useRef(null);
  const lastReadSentRef = useRef(null);
  const loadRequestRef = useRef(0);
  const updateChatTyping = active => { if (chatTypingTimerRef.current) window.clearTimeout(chatTypingTimerRef.current); chatSendRef.current?.({ type: "typing", active: Boolean(active) }); if (active) chatTypingTimerRef.current = window.setTimeout(() => { chatTypingTimerRef.current = null; chatSendRef.current?.({ type: "typing", active: false }); }, 1800); };

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    try {
      const { data } = await api.get("/professionals/me/dashboard");
      if (requestId !== loadRequestRef.current) return;
      setRequests(data.requests || []); setSessions(data.sessions || []); setAvailability(data.availability || []); setAppointmentRequests(data.appointment_requests || []);
      setServerRadar(Array.isArray(data.radar) ? data.radar : []); setProfessionalMetrics(data.metrics || null);
      setNotifications(data.notifications || []);
      setNotificationUnreadCount(typeof data.notification_unread_count === "number" ? data.notification_unread_count : null);
      setLoadError("");
      // Certificate eligibility is secondary and must not block the agenda.
      void api.get("/professionals/me/certificate").then(({ data: certificateData }) => {
        if (requestId !== loadRequestRef.current) return;
        setCertificate(certificateData?.certificate || null);
        setCertificateEligibility({ eligible: Boolean(certificateData?.eligible), completed_count: certificateData?.completed_count || 0, required_count: certificateData?.required_count || 5 });
      }).catch(() => { if (requestId === loadRequestRef.current) setCertificateEligibility(current => ({ ...current, error: "Certificado indisponível no momento." })); });
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(apiError(error));
      throw error;
    } finally { if (requestId === loadRequestRef.current) setLoading(false); }
  }, []);

  useEffect(() => { load().catch(e => toast.error(apiError(e))); }, [load]);
  const run = async (fn, okMsg) => {
    if (actionBusyRef.current) return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); }
    catch (e) { toast.error(apiError(e)); actionBusyRef.current = false; setActionBusy(false); return; }
    actionBusyRef.current = false;
    setActionBusy(false);
    load().catch(() => toast.error("A ação foi concluída, mas o painel não atualizou. Recarregue a página."));
  };
  const issueCertificate = async () => {
    try { const { data } = await api.post("/professionals/me/certificate", {}); setCertificate(data.certificate); toast.success("Certificado emitido."); }
    catch (e) { toast.error(apiError(e)); }
  };
  const printCertificate = (preview = false) => {
    if ((!certificate && !preview) || typeof window === "undefined") return;
    const printable = { ...(certificate || { title: "Certificado de participação no piloto Acolhe", professional_name: "Nome do profissional", institution_name: "Instituição participante", completed_count: 5, issued_at: new Date().toISOString(), code: "PRÉVIA-ACOLHE" }) };
    const popup = window.open("", "_blank", "width=700,height=900");
    if (!popup) { toast.error("Permita pop-ups para imprimir o certificado."); return; }
    const brandMarkUrl = `${window.location.origin}/brand-mark.png`;
    const qrData = preview ? window.location.origin : `${window.location.origin}/validar-certificado/${encodeURIComponent(printable.code)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&color=52358d&bgcolor=ffffff&data=${encodeURIComponent(qrData)}`;
    // Certificate values are user-controlled; escape them before inserting
    // into the print window HTML.
    printable.title = escapeHtml(printable.title);
    printable.professional_name = escapeHtml(printable.professional_name);
    printable.institution_name = escapeHtml(printable.institution_name);
    printable.code = escapeHtml(printable.code);
    printable.completed_count = Number.isFinite(Number(printable.completed_count)) ? Math.max(0, Math.trunc(Number(printable.completed_count))) : 0;
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet"><title>${printable.title}</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#f7f4fb;color:#30243f;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.certificate{position:relative;width:min(560px,calc(100vw - 64px));min-height:790px;padding:86px 46px 64px;text-align:center;background:white;border:10px solid #eee4fb;outline:1px solid #7650c8;outline-offset:-22px}.brand-header{position:absolute;top:30px;left:34px;display:flex;align-items:center;gap:9px;color:#52358d;font-size:22px;font-weight:700;letter-spacing:-.6px}.brand-header img{width:32px;height:32px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(76,52,124,.2))}.eyebrow{color:#7650c8;letter-spacing:3px;text-transform:uppercase;font-size:12px;font-weight:700}.title{font-size:30px;line-height:1.18;margin:30px auto 18px;max-width:680px}.name{font-size:28px;font-weight:700}.meta{color:#716780;line-height:1.7;margin-top:24px}.meta strong{color:#52358d}.period{font-size:13px;color:#8a7b99;margin-top:4px}.qr-block{position:absolute;right:38px;bottom:64px;display:grid;justify-items:center;gap:4px;color:#7650c8;font-size:9px;letter-spacing:.3px}.qr-block img{width:72px;height:72px;padding:5px;background:#fff;border:1px solid #ded0f2;border-radius:8px}.qr-code{max-width:130px;overflow-wrap:anywhere;font-size:8px;line-height:1.2}.signature{position:absolute;left:64px;bottom:78px;text-align:left;color:#716780;font-size:11px;line-height:1.35}.signature:before{content:"";display:block;width:150px;border-top:1px solid #b9a5d3;margin-bottom:7px}.signature strong{display:block;color:#52358d;font-size:12px}.preview{position:absolute;inset:45% auto auto 50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:54px;letter-spacing:8px;color:rgba(118,80,200,.055);font-weight:800;pointer-events:none}@media print{html,body{width:210mm;height:auto;min-height:0;background:white;display:block}.certificate{width:210mm;height:297mm;min-height:0;margin:0 auto;padding:78px 54px 100px;border-width:8px;box-shadow:none;break-inside:avoid;page-break-inside:avoid}.brand-header{top:36px;left:46px;font-size:30px;gap:12px}.brand-header img{width:42px;height:42px}.eyebrow{font-size:15px;letter-spacing:4px}.title{font-size:42px;line-height:1.16;margin:44px auto 28px;max-width:760px}.name{font-size:36px}.meta{font-size:18px;line-height:1.65;margin-top:30px}.period{font-size:16px;margin-top:8px}.qr-block{bottom:55mm;right:48px;font-size:12px;gap:6px}.qr-block img{width:96px;height:96px;padding:6px}.qr-code{max-width:170px;font-size:10px}.signature{bottom:55mm;left:72px;font-size:15px;line-height:1.45}.signature:before{width:190px;margin-bottom:9px}.signature strong{font-size:16px}}</style></head><body><main class="certificate">${preview ? '<div class="preview">PRÉVIA</div>' : ''}<div class="brand-header"><img src="${brandMarkUrl}" alt=""><span>Acolhe</span></div><div class="eyebrow">Piloto institucional</div><h1 class="title">Reconhecemos sua participação <em style="color:#7650c8;font-family:Fraunces,Georgia,serif;font-style:italic">no piloto Acolhe.</em></h1><div class="name">${printable.professional_name}</div><p class="meta">Sua contribuição em <strong>${printable.completed_count} conversas concluídas</strong> ajudou a construir este piloto.<br>${printable.institution_name}</p><div class="period">Período de participação · Piloto institucional 2026<br>Emitido em ${formatDate(printable.issued_at)}</div><div class="signature"><strong>Equipe Acolhe</strong>Um primeiro passo para buscar apoio.</div><div class="qr-block"><img src="${qrUrl}" alt="QR Code para validar o certificado"><span>Validar certificado</span><span class="qr-code">Código: ${printable.code}</span></div></main><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
    const cert = popup.document.querySelector(".certificate");
    if (cert) {
      cert.style.padding = "0";
      Object.assign(popup.document.querySelector(".brand-header").style, { top: "30px", left: "40px", fontSize: "24px", gap: "10px" });
      Object.assign(popup.document.querySelector(".eyebrow").style, { position: "absolute", top: "96px", left: "0", right: "0", fontSize: "13px", letterSpacing: "4px" });
      Object.assign(popup.document.querySelector(".title").style, { position: "absolute", top: "130px", left: "40px", right: "40px", fontSize: "34px", lineHeight: "1.16", margin: "0 auto" });
      Object.assign(popup.document.querySelector(".name").style, { position: "absolute", top: "240px", left: "0", right: "0", fontSize: "30px" });
      Object.assign(popup.document.querySelector(".meta").style, { position: "absolute", top: "305px", left: "48px", right: "48px", fontSize: "17px", lineHeight: "1.7", margin: "0" });
      Object.assign(popup.document.querySelector(".period").style, { position: "absolute", top: "402px", left: "0", right: "0", fontSize: "14px", margin: "0" });
      Object.assign(popup.document.querySelector(".brand-header img").style, { width: "36px", height: "36px" });
      Object.assign(popup.document.querySelector(".qr-block").style, { bottom: "78px", right: "44px", fontSize: "10px", gap: "4px" });
      Object.assign(popup.document.querySelector(".qr-block img").style, { width: "86px", height: "86px", padding: "6px" });
      Object.assign(popup.document.querySelector(".signature").style, { bottom: "80px", left: "72px", fontSize: "13px", lineHeight: "1.4" });
    }
    popup.document.head.insertAdjacentHTML("beforeend", `<style>@media print{.certificate{padding:0}.brand-header{top:30px;left:40px;font-size:24px;gap:10px}.brand-header img{width:36px;height:36px}.eyebrow{position:absolute;top:96px;left:0;right:0;font-size:13px;letter-spacing:4px}.title{position:absolute;top:130px;left:40px;right:40px;font-size:34px;line-height:1.16;margin:0 auto;max-width:620px}.name{position:absolute;top:240px;left:0;right:0;font-size:30px}.meta{position:absolute;top:305px;left:48px;right:48px;font-size:17px;line-height:1.7;margin:0}.period{position:absolute;top:402px;left:0;right:0;font-size:14px;margin:0}.qr-block{bottom:78px;right:44px;font-size:10px;gap:4px}.qr-block img{width:86px;height:86px;padding:6px}.signature{bottom:80px;left:72px;font-size:13px;line-height:1.4}.signature:before{width:168px;margin-bottom:8px}.signature strong{font-size:14px}}</style>`);
  };

  const proposeAppointment = async requestId => {
    const custom = appointmentCustom[requestId] || {};
    if (!custom.date || !custom.time) { toast.error("Escolha uma data e hora para propor."); return; }
    await run(async () => {
      await api.post(`/professionals/me/appointment-requests/${requestId}/propose`, { date: custom.date, time: custom.time, ...(custom.availability_id ? { availability_id: custom.availability_id } : {}) }, { timeout: 30_000 });
      setAppointmentRequests(current => current.map(item => item.id === requestId
        ? { ...item, status: "proposed", date: custom.date, time: custom.time, next_step: "Aguardando confirmação do estudante.", response_overdue: false, response_state: "responded" }
        : item));
    }, "Proposta enviada ao estudante.");
  };
  const availableOptions = item => availability.filter(slot => slot.status === "open" && (!item.meeting_mode || item.meeting_mode !== "presencial" || slot.mode === "presencial")).slice(0, 3);
  const declineAppointment = async requestId => {
    if (typeof window !== "undefined" && !window.confirm("Recusar este pedido de atendimento?")) return;
    await run(() => api.post(`/professionals/me/appointment-requests/${requestId}/decline`), "Pedido recusado.");
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
    try { updateChatTyping(false); const { data } = await api.post(`/professionals/me/sessions/${sessionId}/messages`, { body }); if (chatSessionRef.current === sessionId) { setChatMessages(current => current.some(message => message.id === data.id) ? current : [...current, data]); setChatDraft(""); } }
    catch (e) { toast.error(apiError(e)); }
    finally { setChatBusy(false); }
  };
  const retryChat = async sessionId => {
    setChatError("");
    setChatLoading(true);
    try { const { data } = await api.get(`/professionals/me/sessions/${sessionId}/messages`); if (chatSessionRef.current !== sessionId) return; const messages = data || []; setChatMessages(messages); const lastRead = [...messages].reverse().find(message => message.sender_role === "professional" && message.read_at); setChatReadAt(lastRead?.read_at || null); }
    catch { if (chatSessionRef.current === sessionId) setChatError("Não foi possível carregar as mensagens."); }
    finally { if (chatSessionRef.current === sessionId) setChatLoading(false); }
  };
  useEffect(() => {
    if (!chatSession) return undefined;
    let active = true;
    const refreshChat = async () => {
      setChatLoading(true);
      try { const { data } = await api.get(`/professionals/me/sessions/${chatSession}/messages`); if (!active) return; const messages = data || []; setChatMessages(messages); setChatError(""); const lastRead = [...messages].reverse().find(message => message.sender_role === "professional" && message.read_at); setChatReadAt(lastRead?.read_at || null); } catch { if (active) { setChatError("Não foi possível carregar as mensagens."); toast.error("Não foi possível carregar as mensagens. Tente novamente."); } } finally { if (active) setChatLoading(false); }
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
    const incoming = [...chatMessages].reverse().find(message => message.sender_role !== "professional");
    const readKey = `${chatSession}:${incoming?.id || ""}`;
    if (chatRealtimeConnected && incoming && lastReadSentRef.current !== readKey) { lastReadSentRef.current = readKey; chatSendRef.current?.({ type: "read", messageId: incoming.id }); }
  }, [chatMessages, chatRealtimeConnected, chatSession]);
  useEffect(() => {
    const container = chatMessagesRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [chatMessages.length, chatSession]);

  const pending = requests.filter(r => r.status === "pending");
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completed = sessions.filter(s => s.status === "completed");
  const hasOperation = appointmentRequests.length > 0 || pending.length > 0 || scheduled.length > 0 || completed.length > 0;
  const overdue = [...pending, ...appointmentRequests].filter(item => item.response_overdue);
  const dueSoon = [...pending, ...appointmentRequests].filter(item => !item.response_overdue && item.response_state === "due_soon");
  const todaySessions = scheduled.filter(item => item.date === todayIso());
  const missingRoom = scheduled.filter(item => item.meeting_mode !== "presencial" && !item.room_link);
  const pendingReferral = completed.filter(item => !item.referral);
  const upcomingOpen = availability.filter(item => item.status === "open").slice(0, 3);
  const computedRadarItems = [
    ...(overdue.length ? [{ priority: "Alta", tone: "off", description: `${overdue.length} pedido${overdue.length === 1 ? " está" : "s estão"} além de 48 horas.`, reason: "O prazo operacional já foi ultrapassado.", action: "Responder agora", target: "professional-requests" }] : []),
    ...(dueSoon.length ? [{ priority: "Atenção", tone: "wait", description: `${dueSoon.length} pedido${dueSoon.length === 1 ? " está" : "s estão"} próximo${dueSoon.length === 1 ? "" : "s"} do prazo.`, reason: "Uma resposta antes de 48 horas evita atraso.", action: "Revisar pedidos", target: "professional-requests" }] : []),
    ...(todaySessions.length ? [{ priority: "Hoje", tone: "ok", description: `${todaySessions.length} conversa${todaySessions.length === 1 ? "" : "s"} agendada${todaySessions.length === 1 ? "" : "s"} para hoje.`, reason: "Prepare a modalidade e a sala antes do horário.", action: "Abrir agenda", target: "professional-sessions-card" }] : []),
    ...(missingRoom.length ? [{ priority: "Atenção", tone: "wait", description: `${missingRoom.length} conversa${missingRoom.length === 1 ? " está" : "s estão"} sem link de sala.`, reason: "O estudante precisa de uma orientação prática para entrar.", action: "Configurar sala", target: "professional-sessions-card" }] : []),
    ...(pendingReferral.length ? [{ priority: "Depois da conversa", tone: "wait", description: `${pendingReferral.length} encerramento${pendingReferral.length === 1 ? "" : "s"} ainda não tem encaminhamento operacional.`, reason: "O registro ajuda a manter a continuidade do fluxo.", action: "Revisar histórico", target: "professional-completed-card" }] : []),
    ...(upcomingOpen.length ? [{ priority: "Capacidade", tone: "ok", description: `${upcomingOpen.length} horário${upcomingOpen.length === 1 ? " livre" : "s livres"} próximo${upcomingOpen.length === 1 ? "" : "s"}.`, reason: "Horários publicados podem receber novas solicitações.", action: "Ver horários", target: "professional-capacity-card" }] : []),
  ];
  const radarItems = serverRadar.length ? serverRadar.map(item => ({ priority: item.priority === "high" ? "Alta" : item.priority === "medium" ? "Atenção" : "Depois", tone: item.priority === "high" ? "off" : item.priority === "medium" ? "wait" : "ok", description: item.title, reason: item.reason, action: item.next_step, target: item.type === "pending_request" ? "professional-requests" : item.type === "today_session" || item.type === "missing_room_link" ? "professional-sessions-card" : item.type === "pending_referral" ? "professional-completed-card" : "professional-capacity-card" })) : computedRadarItems;
  const reservedSlots = Number.isFinite(professionalMetrics?.availability_reserved) ? professionalMetrics.availability_reserved : availability.filter(item => item.status === "reserved").length;
  const openSlots = Number.isFinite(professionalMetrics?.availability_open) ? professionalMetrics.availability_open : availability.filter(item => item.status === "open").length;
  const publishedSlots = Number.isFinite(professionalMetrics?.availability_published) ? professionalMetrics.availability_published : availability.length;
  const capacityTotal = openSlots + reservedSlots;
  const utilization = Number.isFinite(professionalMetrics?.utilization_percent) ? professionalMetrics.utilization_percent : capacityTotal ? Math.round((reservedSlots / capacityTotal) * 100) : null;
  const conversations = scheduled.map(session => ({
    id: session.id,
    title: "Conversa agendada",
    subtitle: `${formatDate(session.date)} · ${session.time}`,
    meta: (notifications || []).some(n => !n.read && n.type === "chat_message_received" && n.meta?.session_id === session.id) ? "Nova mensagem" : reasonLabel(session.reason_code),
  }));
  const renderFloatingChat = (sessionId, close) => <div className="mvp-floating-chat">{chatError && chatSession === sessionId && <div className="mvp-chat-error" role="alert"><span>{chatError}</span><button type="button" className="button quiet small" onClick={() => retryChat(sessionId)}>Tentar novamente</button></div>}
    <div className="mvp-chat-head"><strong>Chat da conversa</strong><small>{chatOnline ? "Online agora" : "Converse apenas sobre a organização do encontro. O conteúdo não é visível para a instituição."}{chatTyping ? " · Digitando…" : ""}</small></div>
    <div className="mvp-chat-messages" ref={chatMessagesRef}>{chatLoading && chatSession === sessionId ? <MvpEmpty>Carregando mensagens…</MvpEmpty> : chatSession === sessionId && chatMessages.length ? chatMessages.map(message => <div className={`mvp-chat-message ${message.sender_role === "professional" ? "mine" : "theirs"}`} key={message.id}>{message.body}{message.sender_role === "professional" && chatReadAt && <small className="mvp-chat-read">✓✓</small>}</div>) : <MvpEmpty>Nenhuma mensagem ainda.</MvpEmpty>}</div>
    <div className="mvp-chat-compose"><input aria-label="Mensagem para a conversa" value={chatSession === sessionId ? chatDraft : ""} maxLength={1000} placeholder="Escreva uma mensagem prática…" onChange={e => { setChatDraft(e.target.value); updateChatTyping(Boolean(e.target.value.trim())); }} onBlur={() => updateChatTyping(false)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(sessionId); } }} /><button type="button" aria-label="Enviar mensagem" className="button small primary" onClick={() => sendChat(sessionId)} disabled={chatBusy || !chatDraft.trim()}><Send size={14} /></button></div>
    <button type="button" className="mvp-floating-chat-close" onClick={() => { chatSessionRef.current = null; setFloatingChatSession(null); setChatSession(null); close(); }}>Fechar conversa</button>
  </div>;

  return (
    <MvpShell
      testid="professional-area"
      kicker="Área do profissional"
      title={<>Sua agenda no <em>piloto.</em></>}
      lead="Receba pedidos, combine uma data e registre apenas o desfecho operacional de cada conversa."
      flow={["Receba pedidos", "Proponha um horário", "Registre o desfecho"]}
      collapsePassword
      hideIdentity
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
      <MvpCard title="Radar de hoje" subtitle="O que merece sua atenção agora, com base apenas no estado operacional da sua agenda." testid="pro-radar-card" className="professional-radar-card">
        {radarItems.length ? <div className="professional-radar-list">{radarItems.map((item, index) => <div className="professional-radar-item" key={`${item.target}:${index}`}><div className="professional-radar-copy"><span className={`mvp-tag ${item.tone}`}>{item.priority}</span><strong>{item.description}</strong><small>{item.reason}</small><em>Ação sugerida: {item.action}</em></div><a className="button quiet small" href={`#${item.target}`}>Abrir contexto</a></div>)}</div> : <MvpEmpty>Nenhum alerta operacional agora. Quando houver algo a revisar, ele aparecerá aqui.</MvpEmpty>}
      </MvpCard>

      <MvpCard id="professional-capacity-card" title="Minha capacidade" subtitle="Somente os seus horários publicados no piloto; sem ranking entre profissionais." testid="pro-capacity-card" className="professional-capacity-card">
        <div className="mvp-kpis professional-capacity-kpis"><div><strong>{publishedSlots}</strong><span>Horários publicados</span></div><div><strong>{reservedSlots}</strong><span>Reservados</span></div><div><strong>{openSlots}</strong><span>Livres</span></div><div><strong>{utilization == null ? "—" : `${utilization}%`}</strong><span>Utilização</span></div></div>
        <p className="mvp-note">Pedidos recusados especificamente por falta de disponibilidade: não foi possível determinar com os registros atuais. A distribuição semanal detalhada aparecerá quando houver dados suficientes; o painel não expõe comparações individuais.</p>
      </MvpCard>

      {appointmentRequests.length > 0 && <MvpCard id="professional-requests" title="Pedidos diretos de atendimento" subtitle="Estudantes que escolheram você para propor uma data e horário." testid="pro-appointment-requests-card" className="professional-requests-card">
        {appointmentRequests.map(item => <div className="mvp-row professional-appointment-request" key={item.id} data-testid={`pro-appointment-request-${item.id}`}>
          <div className="mvp-row-main"><strong>{item.student_name}</strong><span>{reasonLabel(item.reason_code)} · {item.meeting_mode === "presencial" ? "Presencial" : "Online"}</span>{item.note && <span>“{item.note}”</span>}{item.status === "proposed" && <span>Proposta enviada: {formatDate(item.date)} · {item.time}</span>}<small className="mvp-next-step">{item.response_overdue ? "Resposta atrasada — priorize este pedido." : item.response_state === "due_soon" ? "Prazo próximo — responda antes de 48h." : `Próximo passo: ${item.next_step}`}</small></div>
          {item.status === "pending" ? <div className="mvp-row-actions professional-appointment-actions">
            <div className="appointment-custom-choice"><label>Data proposta <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" value={appointmentCustom[item.id]?.dateText || ""} onChange={e => { const dateText = formatBrazilianDateInput(e.target.value); setAppointmentCustom(current => ({ ...current, [item.id]: { ...current[item.id], availability_id: "", dateText, date: parseBrazilianDate(dateText) || "" } })); }} /></label><label>Hora <select value={appointmentCustom[item.id]?.time || ""} onChange={e => setAppointmentCustom(current => ({ ...current, [item.id]: { ...current[item.id], availability_id: "", time: e.target.value } }))}><option value="">Escolha</option>{TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}</select></label></div>
            {availableOptions(item).length > 0 && <div className="professional-slot-suggestions"><small>Usar disponibilidade publicada (até 3 opções)</small>{availableOptions(item).map(slot => <button type="button" className={`button quiet small ${appointmentCustom[item.id]?.availability_id === slot.id ? "is-selected" : ""}`} key={slot.id} onClick={() => setAppointmentCustom(current => ({ ...current, [item.id]: { ...current[item.id], availability_id: slot.id, date: slot.date, time: slot.time, dateText: slot.date.split("-").reverse().join("/") } }))}>{slot.date.split("-").reverse().join("/")} · {slot.time} · {slot.mode === "presencial" ? "Presencial" : "Online"}</button>)}</div>}
            <div className="appointment-action-buttons"><button type="button" className="button small primary" onClick={() => proposeAppointment(item.id)} disabled={actionBusy || !(appointmentCustom[item.id]?.date && appointmentCustom[item.id]?.time)} aria-busy={actionBusy}>Propor horário</button><button type="button" className="button small quiet" onClick={() => declineAppointment(item.id)} disabled={actionBusy} aria-busy={actionBusy}>Recusar</button></div>
          </div> : <div className="mvp-row-actions"><span className="mvp-tag wait">Aguardando aluno</span></div>}
        </div>)}
      </MvpCard>}

      {pending.length > 0 && <MvpCard id="professional-pending-requests" title="Solicitações recebidas" subtitle="Motivo geral informado pelo estudante — sem triagem clínica." testid="pro-requests-card" className="professional-requests-card">
        {pending.map(r => (
          <div className="mvp-row" key={r.id} data-testid={`pro-request-${r.id}`}>
            <div className="mvp-row-main">
              <strong>{formatDate(r.date)} · {r.time}</strong>
              <span>{reasonLabel(r.reason_code)} · {r.meeting_mode === "presencial" ? "Presencial · na instituição" : "Online"}</span>
              <small className="mvp-next-step">{r.response_overdue ? "Resposta atrasada — priorize este pedido." : r.response_state === "due_soon" ? "Prazo próximo — responda antes de 48h." : `Próximo passo: ${r.next_step}`}</small>
              {r.reason_note && <span>“{r.reason_note}”</span>}
            </div>
            <div className="mvp-row-actions">
              <button type="button" className="button small primary" onClick={() => run(() => api.post(`/professionals/me/requests/${r.id}/accept`), "Solicitação aceita.")}
                disabled={actionBusy} aria-busy={actionBusy} data-testid={`accept-request-${r.id}`}>Aceitar</button>
              <button type="button" className="button small quiet" onClick={() => run(() => api.post(`/professionals/me/requests/${r.id}/decline`), "Solicitação recusada.")}
                disabled={actionBusy} aria-busy={actionBusy} data-testid={`decline-request-${r.id}`}>Recusar</button>
            </div>
          </div>
        ))}
      </MvpCard>}

      <MvpCard title="Reconhecimento no piloto" subtitle="Um registro verificável da sua participação no Acolhe." testid="pro-certificate-card" className="professional-certificate-card">
        {certificate ? <div className="professional-certificate-ready"><div><strong>{certificate.title}</strong><span>{certificate.completed_count} conversas concluídas · código {certificate.code}</span></div><button type="button" className="button small secondary" onClick={() => printCertificate(false)}><Award size={14}/> Imprimir / salvar PDF</button></div> : <div className="professional-certificate-progress"><div><strong>{certificateEligibility.eligible ? "Seu certificado está pronto." : "Certificado de participação"}</strong><span>{certificateEligibility.eligible ? "Emita quando quiser." : `${certificateEligibility.completed_count} de ${certificateEligibility.required_count} conversas concluídas.`}</span></div>{certificateEligibility.eligible ? <button type="button" className="button small primary" onClick={issueCertificate}><Award size={14}/> Emitir certificado</button> : <div className="professional-certificate-actions"><button type="button" className="button small secondary" onClick={() => printCertificate(true)}><Award size={14}/> Ver prévia</button><small>Disponível após 5 conversas concluídas.</small></div>}</div>}
      </MvpCard>

      {scheduled.length > 0 && <MvpCard id="professional-sessions-card" title="Próximas conversas" subtitle="Prepare a sala externa e marque a conversa como realizada ao final." testid="pro-sessions-card" className="professional-sessions-card">
        {scheduled.map(s => (
          <div className="mvp-row professional-session-row" key={s.id} style={{ display: "block" }} data-testid={`pro-session-${s.id}`}>
            <div className="mvp-row" style={{ borderTop: 0, padding: 0 }}>
              <div className="mvp-row-main"><strong>{s.student_name || "Estudante"}</strong><span>Encontro confirmado: {formatDate(s.date)} · {s.time} · {s.meeting_mode === "presencial" ? "Presencial · na instituição" : "Online"}</span></div>
              <div className="mvp-row-actions">{s.room_link ? <a className="button small secondary" href={s.room_link} target="_blank" rel="noreferrer" data-testid={`room-link-${s.id}`}>Entrar na sala <ExternalLink size={14} /></a> : <button type="button" className="button small secondary professional-room-unavailable" disabled title="O link da sala ainda não foi configurado">Entrar na sala <ExternalLink size={14} /></button> }<button type="button" className="button small primary student-chat-action" onClick={() => openConversationLauncher(s.id)} data-testid={`open-chat-${s.id}`}><MessageCircle size={14} /> Abrir chat</button><button type="button" className="button small primary" disabled={!sessionStarted(s)} title={!sessionStarted(s) ? "Disponível após o horário marcado" : undefined} onClick={() => run(() => api.post(`/professionals/me/sessions/${s.id}/complete`), "Conversa marcada como realizada.")} data-testid={`complete-session-${s.id}`}>Marcar como realizada <Check size={14} /></button><button type="button" className="button small quiet" disabled={!sessionStarted(s)} title={!sessionStarted(s) ? "Disponível após o horário marcado" : undefined} onClick={() => { if (window.confirm("Registrar esta conversa como ausência? Essa ação encerra a sessão.")) run(() => api.post(`/professionals/me/sessions/${s.id}/no-show`), "Ausência registrada."); }} data-testid={`no-show-session-${s.id}`}>Registrar ausência</button></div>
            </div>
            <details className="professional-room-link" style={{ marginTop: 12 }}>
              <summary>{s.room_link ? "Editar link da sala" : "Adicionar link da sala"}</summary>
              <div className="mvp-inline-form">
                <label>Link da sala (externo · provisório no piloto)<input placeholder="https://meet.google.com/…" value={links[s.id] ?? s.room_link ?? ""} onChange={e => setLinks(l => ({ ...l, [s.id]: e.target.value }))} data-testid={`room-link-input-${s.id}`} /></label>
                <button type="button" className="button secondary small" onClick={() => run(() => api.post(`/professionals/me/sessions/${s.id}/room-link`, { room_link: links[s.id] || s.room_link }), "Link salvo.")} data-testid={`save-room-link-${s.id}`}>Salvar link</button>
              </div>
            </details>
            <div className="professional-checklist" aria-label="Checklist pré-conversa"><strong>Pré-conversa</strong><span className="is-done">✓ Horário confirmado</span><span className={s.meeting_mode ? "is-done" : ""}>{s.meeting_mode ? "✓ Modalidade definida" : "○ Modalidade pendente"}</span><span className={s.room_link || s.meeting_mode === "presencial" ? "is-done" : ""}>{s.room_link || s.meeting_mode === "presencial" ? "✓ Sala ou local configurado" : "○ Link da sala pendente"}</span><span className="is-done">✓ Informações práticas prontas</span></div>
          </div>
        ))}
      </MvpCard>}


      {!hasOperation && <MvpCard title="Sua operação" subtitle="Solicitações, conversas agendadas e desfechos aparecerão aqui conforme o piloto for utilizado." testid="pro-empty-operation-card" className="compact-empty-card">
        <MvpEmpty>Nenhuma solicitação ou conversa para acompanhar ainda.</MvpEmpty>
      </MvpCard>}

      {completed.length > 0 && <details id="professional-completed-card" className="mvp-card mvp-collapsible-card professional-completed-card" data-testid="pro-completed-card">
        <summary className="mvp-card-head"><div><h2>Conversas realizadas e encaminhamentos</h2><p>Registro operacional simples — sem prontuário clínico.</p></div></summary>
        <div className="mvp-collapsible-body">
        {completed.map(s => (
          <div className="mvp-row" key={s.id} style={{ display: "block" }} data-testid={`pro-completed-${s.id}`}>
            <div className="mvp-row" style={{ borderTop: 0, padding: 0 }}>
              <div className="mvp-row-main">
                <strong>{formatDate(s.date)} · {s.time}</strong>
                <span>{s.referral ? REFERRAL_LABELS[s.referral.status] : "Sem encaminhamento registrado"}</span>
              </div>
              <span className="mvp-tag ok">Realizada</span>
            </div>
            <div className="mvp-inline-form" style={{ marginTop: 12 }}>
              <label>Status operacional
                <select value={referrals[s.id]?.status || s.referral?.status || "orientacao"}
                  onChange={e => setReferrals(r => ({ ...r, [s.id]: { ...r[s.id], status: e.target.value } }))}
                  data-testid={`referral-status-${s.id}`}>
                  {Object.entries(REFERRAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>Observação operacional (opcional)
                <input value={referrals[s.id]?.note || ""} onChange={e => setReferrals(r => ({ ...r, [s.id]: { ...r[s.id], note: e.target.value } }))}
                  data-testid={`referral-note-${s.id}`} />
              </label>
              <button type="button" className="button secondary small"
                onClick={() => run(() => api.post(`/professionals/me/sessions/${s.id}/referral`, {
                  status: referrals[s.id]?.status || s.referral?.status || "orientacao",
                  note: referrals[s.id]?.note || null,
                }), "Encaminhamento registrado.")}
                data-testid={`save-referral-${s.id}`}>Registrar</button>
            </div>
            <div className="professional-checklist" aria-label="Checklist pós-conversa"><strong>Pós-conversa</strong><span className="is-done">✓ Conversa encerrada</span><span className={s.referral ? "is-done" : "is-pending"}>{s.referral ? "✓ Encaminhamento operacional registrado" : "○ Encaminhamento operacional pendente"}</span><span className="is-done">✓ Sessão pronta para fechamento</span></div>
          </div>
        ))}
        </div>
      </details>}

      <MvpCard title="Rascunhos de mensagens práticas" subtitle="Modelos editáveis para você revisar e enviar manualmente. Nada é enviado automaticamente." testid="pro-message-drafts-card" className="professional-message-drafts-card">
        <div className="professional-drafts-grid">{Object.entries({ confirmation: "Confirmação de horário", reminder: "Lembrete da conversa", change: "Alteração de horário", room: "Instrução para acessar a sala", linkRequest: "Solicitação de atualização do link" }).map(([key, label]) => <label key={key}>{label}<textarea rows="2" value={drafts[key]} onChange={event => setDrafts(current => ({ ...current, [key]: event.target.value }))} maxLength={500} /></label>)}</div>
        <p className="mvp-note">Use apenas para organização do encontro. Não inclua diagnósticos, interpretações ou informações clínicas.</p>
      </MvpCard>
    </MvpShell>
  );
}
