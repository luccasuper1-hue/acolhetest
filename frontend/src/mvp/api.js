import axios from "axios";

const backendUrl = (import.meta.env.VITE_BACKEND_URL || "").trim().replace(/\/+$/, "");

export function connectRealtime(sessionId, onEvent, onStatus, onReady) {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") return () => {};
  const base = backendUrl || window.location.origin;
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const websocketUrl = base.replace(/^http/i, "ws") + `/api/realtime${query}`;
  let socket;
  let stopped = false;
  let retryTimer;
  let heartbeatTimer;
  let heartbeatTimeout;
  let lastPongAt = 0;
  let attempts = 0;
  let generation = 0;
  const clearRetry = () => { if (retryTimer) { window.clearTimeout(retryTimer); retryTimer = undefined; } };
  const clearHeartbeat = () => { if (heartbeatTimer) { window.clearInterval(heartbeatTimer); heartbeatTimer = undefined; } };
  const clearHeartbeatTimeout = () => { if (heartbeatTimeout) { window.clearTimeout(heartbeatTimeout); heartbeatTimeout = undefined; } };
  const scheduleRetry = () => {
    if (stopped || document.visibilityState === "hidden" || retryTimer) return;
    const delay = Math.min(1000 * (2 ** attempts), 30000);
    attempts += 1;
    retryTimer = window.setTimeout(() => { retryTimer = undefined; connect(); }, delay);
  };
  const connect = () => {
    if (stopped || document.visibilityState === "hidden") return;
    clearRetry();
    const currentGeneration = ++generation;
    try {
      const currentSocket = new WebSocket(websocketUrl);
      socket = currentSocket;
      currentSocket.addEventListener("open", () => { if (currentGeneration !== generation) return; attempts = 0; clearRetry(); clearHeartbeat(); clearHeartbeatTimeout(); lastPongAt = Date.now(); heartbeatTimer = window.setInterval(() => { try { if (currentSocket.readyState !== WebSocket.OPEN) return; currentSocket.send(JSON.stringify({ type: "ping" })); clearHeartbeatTimeout(); heartbeatTimeout = window.setTimeout(() => { if (currentSocket.readyState === WebSocket.OPEN && Date.now() - lastPongAt >= 8_000) currentSocket.close(4000, "heartbeat timeout"); }, 8_000); } catch { /* conexão já encerrada */ } }, 25_000); onStatus?.("open"); onReady?.({ send: payload => { try { if (currentSocket.readyState === WebSocket.OPEN) currentSocket.send(JSON.stringify(payload)); } catch { /* conexão já encerrada */ } } }); });
      currentSocket.addEventListener("message", event => {
        if (currentGeneration !== generation) return;
        try { const payload = JSON.parse(event.data); if (payload?.type === "pong") { lastPongAt = Date.now(); clearHeartbeatTimeout(); return; } onEvent?.(payload); } catch { /* ignora eventos inválidos */ }
      });
      currentSocket.addEventListener("close", () => {
        if (currentGeneration !== generation) return;
        clearHeartbeat();
        clearHeartbeatTimeout();
        onStatus?.("closed");
        if (stopped) return;
        if (document.visibilityState === "hidden") return;
        scheduleRetry();
      });
      currentSocket.addEventListener("error", () => { if (currentGeneration === generation) onStatus?.("error"); });
    } catch { onStatus?.("error"); scheduleRetry(); }
  };
  const resumeWhenVisible = () => {
    if (stopped) return;
    if (document.visibilityState === "hidden") { clearRetry(); if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) socket.close(); return; }
    clearRetry();
    clearHeartbeat();
    clearHeartbeatTimeout();
    if (!socket || socket.readyState === WebSocket.CLOSED) connect();
  };
  document.addEventListener("visibilitychange", resumeWhenVisible);
  connect();
  return () => {
    stopped = true;
    generation += 1;
    clearRetry();
    clearHeartbeat();
    clearHeartbeatTimeout();
    document.removeEventListener("visibilitychange", resumeWhenVisible);
    try { socket?.close(); } catch { /* conexão já encerrada */ }
    socket = undefined;
  };
}

export const api = axios.create({
  // On the unified Cloudflare deployment, API and application share one origin.
  // An explicit URL remains available for an intentionally separate backend.
  baseURL: backendUrl ? `${backendUrl}/api` : "/api",
  withCredentials: true,
  timeout: 15_000,
});

// Several UI effects can request the same dashboard/messages endpoint at the
// same time (for example a realtime event arriving during a manual refresh).
// Share that in-flight GET instead of opening duplicate Durable Object calls.
const pendingGets = new Map();
const MAX_PENDING_GETS = 256;
const originalGet = api.get.bind(api);
api.get = (url, config) => {
  const params = config?.params ? JSON.stringify(config.params) : "";
  const key = `${url}?${params}`;
  const pending = pendingGets.get(key);
  if (pending) return pending;
  const request = originalGet(url, config).finally(() => { if (pendingGets.get(key) === request) pendingGets.delete(key); });
  if (pendingGets.size >= MAX_PENDING_GETS) pendingGets.delete(pendingGets.keys().next().value);
  pendingGets.set(key, request);
  return request;
};

export function resetPendingGets() {
  pendingGets.clear();
}

api.interceptors.request.use(config => {
  // The API enforces JSON Content-Type on state-changing requests, including
  // action endpoints that intentionally carry no body (accept, decline,
  // complete, toggle-active). Axios omits the header when data is undefined.
  const method = String(config.method || "").toLowerCase();
  if (["post", "put", "patch"].includes(method) && config.data === undefined) config.data = {};
  if (["post", "put", "patch", "delete"].includes(method)) {
    const headers = config.headers || {};
    const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === "content-type");
    if (!hasContentType) headers["Content-Type"] = "application/json";
    config.headers = headers;
  }
  return config;
});

export const saveToken = () => {};
export const clearToken = () => { resetPendingGets(); try { localStorage.removeItem("acolhe-mvp-token"); } catch { /* armazenamento indisponível */ } };

export function apiError(error) {
  if (Number(error?.response?.status) >= 500) return "O serviço está temporariamente indisponível. Tente novamente em alguns instantes.";
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg || JSON.stringify(d)).join(" ");
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") return "A conexão demorou demais. Tente novamente.";
  if (!error?.response) return "Não foi possível conectar ao serviço. Tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}

export const REASONS = [
  { code: "conversar", label: "Quero conversar sobre algo que está acontecendo comigo" },
  { code: "dificuldade", label: "Estou passando por uma dificuldade e gostaria de orientação" },
  { code: "orientacao", label: "Quero encontrar apoio" },
  { code: "outro", label: "Prefiro explicar na conversa" },
];

export const REFERRAL_LABELS = {
  orientacao: "Orientação dada na conversa",
  encaminhamento_interno: "Encaminhado para apoio interno da instituição",
  encaminhamento_externo: "Encaminhado para serviço externo",
  sem_encaminhamento: "Sem encaminhamento necessário",
};

export const STATUS_LABELS = {
  pending: "Aguardando profissional",
  proposed: "Aguardando confirmação",
  accepted: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  declined: "Recusada",
  expired: "Expirada",
  no_show: "Não realizada",
  scheduled: "Agendada",
};

const PRODUCT_TIME_ZONE = "America/Fortaleza";

export const formatDate = iso => {
  if (!iso) return "—";
  const raw = String(iso);
  // Date-only scheduling values are already expressed in the product's
  // calendar and must not be shifted through UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: PRODUCT_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
};

export const formatNotificationTime = iso => {
  if (!iso) return "";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "";
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: PRODUCT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: PRODUCT_TIME_ZONE, day: "2-digit", month: "2-digit" });
  const sameDay = dayFormatter.format(value) === dayFormatter.format(new Date());
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: PRODUCT_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(value);
  if (sameDay) return `Hoje, ${time}`;
  const date = dateFormatter.format(value);
  return `${date}, ${time}`;
};

export const formatDateTime = iso => {
  if (!iso) return "";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: PRODUCT_TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(value);
};

export const scheduledTimeHasStarted = (date, time) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !/^\d{2}:\d{2}$/.test(String(time || ""))) return false;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: PRODUCT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${date}T${time}:00` <= `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};
