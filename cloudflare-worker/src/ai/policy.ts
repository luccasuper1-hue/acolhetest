import { validateQuestion } from "./schemas";

const blockedPatterns = [
  /\b(aluno|estudante|pessoa|usu[aá]rio)\b.*\b(risco|problem[aá]tico|precisa|quem)\b/i,
  /\b(terapia|diagn[oó]stico|diagnostique|cl[ií]nic|sintoma)\b/i,
  /\b(leia|mostrar|mostre|exiba|exporte|liste)\b.*\b(conversa|mensagem|nome|e-?mail|dado bruto|aluno|estudante)\b/i,
  /\b(ignore|desconsidere|esqueça)\b.*\b(regras?|instru[cç][õo]es?)\b/i,
  /\b(prompt|system message|mensagem do sistema|token|senha|cookie)\b/i,
];
const intentPatterns: [string, RegExp][] = [
  ["privacy_and_policy", /privacidade|lgpd|cookie|consentimento|menor|adolescente|seguran[cç]a|dados pessoais/i],
  ["pilot_and_roadmap", /piloto|roadmap|futuro|emerg[eê]ncia|onboard|limite do projeto/i],
  ["product_help", /como funciona|fluxo|painel|agenda|disponibilidade|notifica[cç][aã]o|certificado|encaminhamento|proposta|confirma[cç][aã]o/i],
  ["metrics_explanation", /o que significa|como calcula|defini[cç][aã]o|m[eé]trica|indicador/i],
  ["bottlenecks", /gargalo|onde.*trav|problema operacional/i],
  ["response_time", /resposta|tempo médio|tempo de resposta|48\s*h|atrasad|prazo/i],
  ["attendance", /comparecimento|presen[cç]a|aus[eê]ncia/i],
  ["capacity", /capacidade|hor[aá]rio|vaga|disponib|abrir mais/i],
  ["impact", /linha de base|mudou|evolu[íi]u?|evolu[cç][aã]o|impacto|antes|depois|comparar|compara[cç][aã]o|comparativo/i],
  ["demand", /demanda|pedidos|procura|volume|fila/i],
  ["overview", /acolhe|por que usar|pq usar|pr[oó]ximo passo|acompanhar/i],
];
const usage = new Map<string, { day: string; count: number; minute: number; minuteCount: number; fingerprints: Map<string, number> }>();
const dayKey = () => new Date().toISOString().slice(0, 10);

export function inspectQuestion(raw: unknown) {
  const question = validateQuestion(raw);
  if (blockedPatterns.some(pattern => pattern.test(question))) return { allowed: false as const, question, reason: "O Acolhe Insights trabalha apenas com indicadores operacionais agregados e não acessa conversas nem produz avaliações clínicas.", intent: "blocked" };
  const matched = intentPatterns.filter(([, pattern]) => pattern.test(question)).map(([intent]) => intent);
  const intent = matched.length === 1 ? matched[0] : matched.length > 1 && matched.includes("overview") ? matched.find(item => item !== "overview") : matched[0];
  if (!intent) return { allowed: false as const, question, reason: "Posso ajudar com demanda, tempo de resposta, comparecimento, capacidade, evolução da linha de base ou gargalos operacionais. Qual desses temas você quer analisar?", intent: "clarification" };
  if (matched.length > 1 && !matched.includes("overview")) {
    const knowledge = matched.filter(item => ["product_help", "privacy_and_policy", "metrics_explanation", "pilot_and_roadmap"].includes(item));
    if (knowledge.length === 1) return { allowed: true as const, question, intent: knowledge[0] };
    return { allowed: false as const, question, reason: "Posso explicar o produto, privacidade, métricas ou operação. Qual desses temas você quer entender primeiro?", intent: "clarification" };
  }
  const years = [...question.matchAll(/\b(20\d{2})[-/]?(0[1-9]|1[0-2])\b/g)].map(match => Number(match[1]) * 12 + Number(match[2]));
  const relativeMonths = question.match(/(?:últim[oa]s?|pr[oó]xim[oa]s?)\s+(\d+)\s+mes(?:es|es)?/i)?.[1];
  const yearsAgo = question.match(/(?:últim[oa]s?|pr[oó]xim[oa]s?)\s+(\d+)\s+ano/i)?.[1];
  if ((relativeMonths && Number(relativeMonths) > 12) || (yearsAgo && Number(yearsAgo) > 1) || (years.length >= 2 && Math.max(...years) - Math.min(...years) > 12)) return { allowed: false as const, question, reason: "O período máximo para comparação é de 12 meses.", intent: "period_limit" };
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

