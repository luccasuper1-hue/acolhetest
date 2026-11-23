import { validateQuestion } from "./schemas";

const blockedPatterns = [
  /\b(aluno|estudante|pessoa|usu[aá]rio)\b.*\b(risco|problem[aá]tico|precisa|quem)\b/i,
  /\b(terapia|diagn[oó]stico|diagnostique|cl[ií]nic|sintoma)\b/i,
  /\b(leia|mostrar|mostre|exiba|exporte|liste)\b.*\b(conversa|mensagem|nome|e-?mail|dado bruto|aluno|estudante)\b/i,
  /\b(ignore|desconsidere|esqueça)\b.*\b(regras?|instru[cç][õo]es?)\b/i,
  /\b(prompt|system message|mensagem do sistema|token|senha|cookie)\b/i,
];
const intentPatterns: [string, RegExp][] = [
  ["overview", /\b(acolhe|painel|indicador(?:es)?|m[eé]trica(?:s)?|como funciona|por que usar|pq usar|pr[oó]ximo passo)\b/i],
  ["response_time", /resposta|tempo|48\s*h|atrasad|prazo/i],
  ["attendance", /comparecimento|presen[cç]a|aus[eê]ncia/i],
  ["capacity", /capacidade|hor[aá]rio|vaga|disponib|gargalo/i],
  ["impact", /linha de base|mudou|evolu[cç][aã]o|impacto|antes|depois/i],
  ["bottlenecks", /gargalo|onde.*trav|problema operacional/i],
  ["demand", /demanda|pedidos|procura|volume/i],
];
const usage = new Map<string, { day: string; count: number; minute: number; minuteCount: number; fingerprints: Map<string, number> }>();
const dayKey = () => new Date().toISOString().slice(0, 10);

export function inspectQuestion(raw: unknown) {
  const question = validateQuestion(raw);
  if (blockedPatterns.some(pattern => pattern.test(question))) return { allowed: false as const, question, reason: "O Acolhe Insights trabalha apenas com indicadores operacionais agregados e não acessa conversas nem produz avaliações clínicas.", intent: "blocked" };
  const intent = intentPatterns.find(([, pattern]) => pattern.test(question))?.[0];
  if (!intent) return { allowed: false as const, question, reason: "O Acolhe Insights responde apenas sobre demanda, resposta, comparecimento, capacidade, impacto e gargalos operacionais.", intent: "out_of_scope" };
  const years = [...question.matchAll(/\b(20\d{2})[-/]?(0[1-9]|1[0-2])\b/g)].map(match => Number(match[1]) * 12 + Number(match[2]));
  if (years.length >= 2 && Math.max(...years) - Math.min(...years) > 12) return { allowed: false as const, question, reason: "O período máximo para comparação é de 12 meses.", intent: "period_limit" };
  return { allowed: true as const, question, intent };
}

export function consumeInsightQuota(userId: string, institutionId: string, fingerprint: string) {
  const day = dayKey();
  const keys = [`u:${userId}`, `i:${institutionId}`];
  const limits = [20, 100];
  const minute = Math.floor(Date.now() / 60_000);
  for (let index = 0; index < keys.length; index += 1) {
    const current = usage.get(keys[index]);
    const next = !current || current.day !== day ? { day, count: 0, minute, minuteCount: 0, fingerprints: new Map<string, number>() } : current;
    if (next.minute !== minute) { next.minute = minute; next.minuteCount = 0; }
    if (next.minuteCount >= 5) return false;
    const repeated = next.fingerprints.get(fingerprint) || 0;
    if (repeated >= 3) return false;
    if (next.count >= limits[index]) return false;
    next.count += 1;
    next.minuteCount += 1;
    next.fingerprints.set(fingerprint, repeated + 1);
    usage.set(keys[index], next);
  }
  return true;
}

