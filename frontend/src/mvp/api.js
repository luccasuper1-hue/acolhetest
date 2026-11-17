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
  let attempts = 0;
  const clearRetry = () => { if (retryTimer) { window.clearTimeout(retryTimer); retryTimer = undefined; } };
  const connect = () => {
    if (stopped || document.visibilityState === "hidden") return;
    try {
      socket = new WebSocket(websocketUrl);
      socket.addEventListener("open", () => { attempts = 0; onStatus?.("open"); onReady?.({ send: payload => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); } }); });
      socket.addEventListener("message", event => {
        try { onEvent?.(JSON.parse(event.data)); } catch { /* ignora eventos inválidos */ }
      });
      socket.addEventListener("close", () => {
        onStatus?.("closed");
        if (stopped) return;
        if (document.visibilityState === "hidden") return;
        const delay = Math.min(1000 * (2 ** attempts), 30000);
        attempts += 1;
        retryTimer = window.setTimeout(connect, delay);
      });
      socket.addEventListener("error", () => onStatus?.("error"));
    } catch { onStatus?.("error"); }
  };
  const resumeWhenVisible = () => {
    if (stopped || document.visibilityState !== "visible") return;
    clearRetry();
    if (!socket || socket.readyState === WebSocket.CLOSED) connect();
  };
  document.addEventListener("visibilitychange", resumeWhenVisible);
  connect();
  return () => {
    stopped = true;
    clearRetry();
    document.removeEventListener("visibilitychange", resumeWhenVisible);
    socket?.close();
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
const originalGet = api.get.bind(api);
api.get = (url, config) => {
  const params = config?.params ? JSON.stringify(config.params) : "";
  const key = `${url}?${params}`;
  const pending = pendingGets.get(key);
  if (pending) return pending;
  const request = originalGet(url, config).finally(() => pendingGets.delete(key));
  pendingGets.set(key, request);
  return request;
};

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
export const clearToken = () => localStorage.removeItem("acolhe-mvp-token");

export function apiError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg || JSON.stringify(d)).join(" ");
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") return "A conexão demorou demais. Tente novamente.";
  return error?.message || "Não foi possível concluir. Tente novamente.";
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
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
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
