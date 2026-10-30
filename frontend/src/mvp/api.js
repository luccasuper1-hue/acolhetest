import axios from "axios";

const TOKEN_KEY = "acolhe-mvp-token";

const backendUrl = (import.meta.env.VITE_BACKEND_URL || "").trim().replace(/\/+$/, "");

export const api = axios.create({
  // On the unified Cloudflare deployment, API and application share one origin.
  // An explicit URL remains available for an intentionally separate backend.
  baseURL: backendUrl ? `${backendUrl}/api` : "/api",
  withCredentials: true,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const saveToken = token => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function apiError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg || JSON.stringify(d)).join(" ");
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
  accepted: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  declined: "Recusada",
  scheduled: "Agendada",
};

export const formatDate = iso => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
