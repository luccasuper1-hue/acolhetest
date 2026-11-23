import type { Env } from "../index";
import { logOperational } from "../core";
import { consumeInsightQuota, inspectQuestion } from "./policy";
import { runWorkersAi } from "./provider";
import { validateInsightResponse, type InsightResponse } from "./schemas";
import { buildInsightTools, type InsightData } from "./tools";
import { fallbackInsight } from "./fallback";
import { lookupKnowledge } from "./knowledge";
const insightCache = new Map<string, { expires: number; value: InsightResponse }>();
const fingerprint = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 240);
const sanitizeContext = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const text = (key: string) => typeof row[key] === "string" ? String(row[key]).trim().slice(0, 500) : undefined;
  const period = row.period && typeof row.period === "object" ? row.period as Record<string, unknown> : {};
  const limitations = Array.isArray(row.limitations) ? row.limitations.filter((item): item is string => typeof item === "string").slice(0, 6).map(item => item.slice(0, 240)) : [];
  return JSON.stringify({ answer: text("answer"), observation: text("observation"), interpretation: text("interpretation"), next_step: text("next_step"), period: { start: typeof period.start === "string" ? period.start.slice(0, 20) : undefined, end: typeof period.end === "string" ? period.end.slice(0, 20) : undefined }, limitations });
};
const policyResponse = (answer: string, data: InsightData, confidence: "blocked" | "unavailable" | "fallback", limitation: string): InsightResponse => ({ answer, observation: "Nenhum dado individual foi consultado.", interpretation: "Esta solicitação está fora do escopo operacional seguro do Acolhe Insights.", next_step: "Faça uma pergunta sobre demanda, resposta, comparecimento, capacidade, impacto ou gargalos.", sources: [], period: data.period, limitations: [limitation], confidence, fallback: true });
const overviewResponse = (data: InsightData): InsightResponse => ({ answer: "O Acolhe organiza pedidos de apoio, agenda e indicadores operacionais para que a instituição enxergue o próximo passo sem acessar conversas ou dados individuais.", observation: "O painel reúne sinais agregados de demanda, resposta, comparecimento e capacidade.", interpretation: "Esses indicadores ajudam a organizar a operação, mas não avaliam pessoas nem substituem decisões da equipe.", next_step: "Você pode perguntar sobre demanda, tempo de resposta, comparecimento, capacidade ou gargalos.", sources: [], period: data.period, limitations: ["Resposta explicativa sobre o escopo do Acolhe; não é uma métrica nem prova de resultado clínico."], confidence: "fallback", fallback: true });
const knowledgeResponse = (data: InsightData, question: string, intent: string): InsightResponse => { const entry = lookupKnowledge(question); const scope = intent === "privacy_and_policy" ? "privacidade" : intent === "metrics_explanation" ? "métricas" : intent === "pilot_and_roadmap" ? "piloto" : "produto"; return { answer: entry?.answer || "Ainda não encontrei uma explicação documentada para essa pergunta.", observation: `Esta é uma explicação documentada sobre ${scope} do Acolhe.`, interpretation: "A documentação explica o funcionamento previsto; não substitui uma decisão jurídica ou clínica.", next_step: "Se quiser, aprofunde uma parte específica ou pergunte sobre a operação agregada do painel.", sources: entry ? [{ metric: "knowledge", value: null, sample_size: 1, origin: entry.source }] : [], period: data.period, limitations: ["Resposta baseada na documentação operacional versionada; roadmap não representa recurso ativo."], confidence: entry ? "supported" : "insufficient_data", fallback: true, scope, intent, can_deepen: true }; };
export async function handleInstitutionInsight(input: { env: Env; userId: string; institutionId: string; role: string; question: unknown; context?: unknown; metrics: Record<string, any>; impact: Record<string, any> | null }) {
  const data = buildInsightTools(input.metrics, input.impact);
  let checked;
  try { checked = inspectQuestion(input.question); } catch {
    return policyResponse("Escreva uma pergunta sobre os indicadores operacionais do piloto.", data, "unavailable", "A pergunta não passou pela validação de segurança.");
  }
  if (!checked.allowed) return policyResponse(checked.reason, data, checked.intent === "clarification" ? "fallback" : "blocked", checked.intent === "clarification" ? "A pergunta precisa de uma clarificação curta antes da leitura." : "A consulta foi bloqueada por privacidade e segurança.");
  if (checked.intent === "overview") return overviewResponse(data);
  if (["product_help", "privacy_and_policy", "metrics_explanation", "pilot_and_roadmap"].includes(checked.intent)) return knowledgeResponse(data, checked.question, checked.intent);
  const context = sanitizeContext(input.context);
  const key = `${input.institutionId}:${checked.intent}:${data.period.start}:${data.period.end}:${fingerprint(checked.question)}:${fingerprint(context)}`;
  const cached = insightCache.get(key); if (cached && cached.expires > Date.now()) return cached.value;
  if (!consumeInsightQuota(input.userId, input.institutionId, fingerprint(checked.question))) return policyResponse("O limite de consultas do Acolhe Insights foi atingido. Tente novamente em instantes ou amanhã.", data, "fallback", "Limite por minuto, usuário, instituição e repetição de perguntas.");
  const started = Date.now(); let result: InsightResponse = fallbackInsight(data, checked.intent, "O modelo de IA está indisponível ou os dados são insuficientes.");
  const provider = await runWorkersAi(input.env, checked.question, data, context);
  if (provider.available) { try { result = validateInsightResponse(provider.value, false, data.tools); } catch { result = fallbackInsight(data, checked.intent, "A leitura foi calculada diretamente a partir das métricas agregadas disponíveis."); } }
  else if (provider.reason === "missing_binding" || provider.reason === "timeout" || provider.reason === "provider_error") {
    result = fallbackInsight(data, checked.intent, "Não consegui gerar a interpretação agora. Os indicadores básicos continuam disponíveis para consulta.");
  }
  logOperational("institution_insight", { role: input.role, institution_scope: "institution", intent: checked.intent, tools_count: Object.keys(data.tools).length, duration_ms: Date.now() - started, status: provider.available && !result.fallback ? "ok" : "fallback", fallback: result.fallback, metric_count: Object.keys(data.tools).length });
  insightCache.set(key, { expires: Date.now() + 15_000, value: result });
  return result;
}

