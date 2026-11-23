import type { Env } from "../index";
import { logOperational } from "../core";
import { consumeInsightQuota, inspectQuestion } from "./policy";
import { runWorkersAi } from "./provider";
import { validateInsightResponse, type InsightResponse } from "./schemas";
import { buildInsightTools, type InsightData } from "./tools";
import { fallbackInsight } from "./fallback";
const insightCache = new Map<string, { expires: number; value: InsightResponse }>();
const fingerprint = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 240);
const policyResponse = (answer: string, data: InsightData, confidence: "blocked" | "unavailable" | "fallback", limitation: string): InsightResponse => ({ answer, observation: "Nenhum dado individual foi consultado.", interpretation: "Esta solicitação está fora do escopo operacional seguro do Acolhe Insights.", next_step: "Faça uma pergunta sobre demanda, resposta, comparecimento, capacidade, impacto ou gargalos.", sources: [], period: data.period, limitations: [limitation], confidence, fallback: true });
const overviewResponse = (data: InsightData): InsightResponse => ({ answer: "O Acolhe organiza pedidos de apoio, agenda e indicadores operacionais para que a instituição enxergue o próximo passo sem acessar conversas ou dados individuais.", observation: "O painel reúne sinais agregados de demanda, resposta, comparecimento e capacidade.", interpretation: "Esses indicadores ajudam a organizar a operação, mas não avaliam pessoas nem substituem decisões da equipe.", next_step: "Você pode perguntar sobre demanda, tempo de resposta, comparecimento, capacidade ou gargalos.", sources: [], period: data.period, limitations: ["Resposta explicativa sobre o escopo do Acolhe; não é uma métrica nem prova de resultado clínico."], confidence: "fallback", fallback: true });
export async function handleInstitutionInsight(input: { env: Env; userId: string; institutionId: string; role: string; question: unknown; metrics: Record<string, any>; impact: Record<string, any> | null }) {
  const data = buildInsightTools(input.metrics, input.impact);
  let checked;
  try { checked = inspectQuestion(input.question); } catch {
    return policyResponse("Escreva uma pergunta sobre os indicadores operacionais do piloto.", data, "unavailable", "A pergunta não passou pela validação de segurança.");
  }
  if (!checked.allowed) return policyResponse(checked.reason, data, "blocked", "A consulta foi bloqueada por privacidade e segurança.");
  if (checked.intent === "overview") return overviewResponse(data);
  const key = `${input.institutionId}:${checked.intent}:${data.period.start}:${data.period.end}:${fingerprint(checked.question)}`;
  const cached = insightCache.get(key); if (cached && cached.expires > Date.now()) return cached.value;
  if (!consumeInsightQuota(input.userId, input.institutionId, fingerprint(checked.question))) return policyResponse("O limite de consultas do Acolhe Insights foi atingido. Tente novamente em instantes ou amanhã.", data, "fallback", "Limite por minuto, usuário, instituição e repetição de perguntas.");
  const started = Date.now(); let result: InsightResponse = fallbackInsight(data, checked.intent, "O modelo de IA está indisponível ou os dados são insuficientes.");
  const provider = await runWorkersAi(input.env, checked.question, data);
  if (provider.available) { try { result = validateInsightResponse(provider.value, false, data.tools); } catch { result = fallbackInsight(data, checked.intent, "A leitura foi calculada diretamente a partir das métricas agregadas disponíveis."); } }
  else if (provider.reason === "missing_binding" || provider.reason === "timeout" || provider.reason === "provider_error") {
    result = fallbackInsight(data, checked.intent, "Não consegui gerar a interpretação agora. Os indicadores básicos continuam disponíveis para consulta.");
  }
  logOperational("institution_insight", { role: input.role, institution_scope: "institution", intent: checked.intent, tools_count: Object.keys(data.tools).length, duration_ms: Date.now() - started, status: provider.available && !result.fallback ? "ok" : "fallback", fallback: result.fallback, metric_count: Object.keys(data.tools).length });
  insightCache.set(key, { expires: Date.now() + 15_000, value: result });
  return result;
}

