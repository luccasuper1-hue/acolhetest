import type { Env } from "../index";
import { buildPrompt } from "./prompts";
import type { InsightData } from "./tools";
export type AiProviderResult = { value: unknown; available: boolean; reason?: "missing_binding" | "timeout" | "provider_error" | "invalid_output" };
const MODEL = "@cf/meta/llama-3.1-8b-instruct-awq";
function parseModelOutput(candidate: unknown, data: InsightData): unknown {
  if (candidate && typeof candidate === "object") {
    const row = candidate as Record<string, any>;
    if (typeof row.answer === "string" && row.answer.trim()) {
      const sources = Array.isArray(row.sources) && row.sources.length > 0 ? row.sources : Object.values(data.tools).flatMap((tool: any) => [tool?.source, tool?.series_source].filter(Boolean)).slice(0, 8);
      return { answer: row.answer, observation: typeof row.observation === "string" && row.observation.trim() ? row.observation : "O modelo respondeu usando os indicadores agregados autorizados.", interpretation: typeof row.interpretation === "string" && row.interpretation.trim() ? row.interpretation : "A leitura é descritiva e não permite concluir causas ou avaliar pessoas.", next_step: typeof row.next_step === "string" && row.next_step.trim() ? row.next_step : "Vale acompanhar este indicador no próximo período.", sources, period: row.period && typeof row.period === "object" ? row.period : data.period, limitations: Array.isArray(row.limitations) ? row.limitations : data.limitations, confidence: "supported", fallback: false };
    }
    return candidate;
  }
  if (typeof candidate !== "string") return null;
  const text = candidate.trim();
  const candidates = [text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")];
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const item of candidates) { try { return JSON.parse(item); } catch { /* try the next safe extraction */ } }
  // Some Workers AI responses are valid prose despite the JSON instruction.
  // Preserve that answer and attach only already-authorized aggregate sources;
  // schemas.ts will still reject unsupported numbers or missing fields.
  if (text.length > 0) {
    const sources = Object.values(data.tools).flatMap((tool: any) => {
      const values = [tool?.source, tool?.series_source].filter(Boolean);
      return values;
    }).slice(0, 8);
    return { answer: text.slice(0, 1200), observation: "O modelo respondeu usando os indicadores agregados autorizados.", interpretation: "A leitura é descritiva e não permite concluir causas ou avaliar pessoas.", next_step: "Vale acompanhar este indicador no próximo período.", sources, period: data.period, limitations: data.limitations, confidence: "supported", fallback: false };
  }
  return null;
}
export async function runWorkersAi(env: Env, question: string, data: InsightData): Promise<AiProviderResult> {
  if (!env.AI?.run) return { value: null, available: false, reason: "missing_binding" };
  try {
    const result = await Promise.race([env.AI.run(MODEL, { prompt: buildPrompt(question, data), max_tokens: 500 }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("ai_timeout")), 5_000))]);
    const candidate = result && typeof result === "object" && "response" in result ? (result as { response: unknown }).response : result;
    const value = parseModelOutput(candidate, data);
    return value ? { value, available: true } : { value: null, available: true, reason: "invalid_output" };
  } catch (error) { return { value: null, available: false, reason: error instanceof Error && error.message === "ai_timeout" ? "timeout" : "provider_error" }; }
}

