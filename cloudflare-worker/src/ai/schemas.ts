export type InsightConfidence = "supported" | "insufficient_data" | "fallback" | "blocked" | "unavailable";
export type InsightSource = { metric: string; value?: number | Array<Record<string, unknown>> | null; sample_size: number; origin: string };
export type InsightPeriod = { start: string; end: string };
export type InsightResponse = {
  answer: string;
  observation: string;
  interpretation: string;
  next_step: string;
  sources: InsightSource[];
  period: InsightPeriod;
  limitations: string[];
  confidence: InsightConfidence;
  fallback: boolean;
  scope?: string;
  intent?: string;
  can_deepen?: boolean;
};

const confidence = new Set<InsightConfidence>(["supported", "insufficient_data", "fallback", "blocked", "unavailable"]);
export function validateQuestion(value: unknown): string {
  if (typeof value !== "string") throw new Error("Pergunta inválida");
  const question = value.trim();
  if (!question || question.length > 600) throw new Error("A pergunta deve ter entre 1 e 600 caracteres");
  return question;
}

export function validateInsightResponse(value: unknown, fallback = false, authorizedData?: Record<string, unknown>): InsightResponse {
  if (!value || typeof value !== "object") throw new Error("Resposta inválida");
  const row = value as Record<string, unknown>;
  const answer = typeof row.answer === "string" ? row.answer.trim() : "";
  const observation = typeof row.observation === "string" ? row.observation.trim() : "";
  const interpretation = typeof row.interpretation === "string" ? row.interpretation.trim() : "";
  const next_step = typeof row.next_step === "string" ? row.next_step.trim() : "";
  const sources = Array.isArray(row.sources) ? row.sources : [];
  const limitations = Array.isArray(row.limitations) ? row.limitations.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  const rawPeriod = row.period && typeof row.period === "object" ? row.period as Record<string, unknown> : {};
  const period = { start: typeof rawPeriod.start === "string" ? rawPeriod.start : "", end: typeof rawPeriod.end === "string" ? rawPeriod.end : "" };
  const safeSources: InsightSource[] = sources.slice(0, 8).filter(Boolean).map((item) => {
    const source = item as Record<string, unknown>;
    const value = typeof source.value === "number" ? source.value : Array.isArray(source.value) ? source.value.slice(0, 24).filter(item => item && typeof item === "object") as Array<Record<string, unknown>> : null;
    return { metric: typeof source.metric === "string" ? source.metric.slice(0, 100) : "", value, sample_size: Number.isFinite(Number(source.sample_size)) ? Math.max(0, Number(source.sample_size)) : 0, origin: typeof source.origin === "string" && source.origin.trim() ? source.origin.slice(0, 120) : "métricas agregadas autorizadas" };
  }).filter(item => item.metric && item.origin);
  const selected = confidence.has(row.confidence as InsightConfidence) ? row.confidence as InsightConfidence : (fallback ? "fallback" : "supported");
  if (!answer || !observation || !interpretation || !next_step || [answer, observation, interpretation, next_step].some(item => item.length > 1200) || !period.start || !period.end) throw new Error("Resposta incompleta");
  if (!fallback && selected === "supported" && safeSources.length === 0) throw new Error("Resposta sem fontes");
  if (authorizedData && selected === "supported") {
    const authorizedText = JSON.stringify(authorizedData);
    const allowedMetrics = [...authorizedText.matchAll(/"metric":"([^"]+)"/g)].map(match => match[1]);
    if (safeSources.some(item => !allowedMetrics.includes(item.metric))) throw new Error("Fonte inexistente");
    const authorizedNumbers = authorizedText.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const answerNumbers = answer.match(/-?\d+(?:[.,]\d+)?/g)?.map(value => Number(value.replace(",", "."))) || [];
    const constants = [0, 1, 5, 12, 15, 24, 30, 48, 60, 100];
    if (answerNumbers.some(number => !constants.includes(number) && !authorizedNumbers.some(allowed => Math.abs(allowed - number) < 0.001))) throw new Error("Número sem fonte");
  }
  return { answer, observation, interpretation, next_step, sources: safeSources, period, limitations, confidence: selected, fallback: Boolean(row.fallback) || fallback, scope: typeof row.scope === "string" ? row.scope.slice(0, 40) : undefined, intent: typeof row.intent === "string" ? row.intent.slice(0, 60) : undefined, can_deepen: row.can_deepen !== false };
}

