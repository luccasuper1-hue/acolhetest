import type { Env } from "../index";
import { buildPrompt } from "./prompts";
import type { InsightData } from "./tools";
export type AiProviderResult = { value: unknown; available: boolean; reason?: "missing_binding" | "timeout" | "provider_error" | "invalid_output" };
// Use the currently supported low-latency Workers AI variant. The former
// AWQ model was deprecated by Cloudflare and silently pushed requests into
// the deterministic fallback path.
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
function stripEmbeddedJson(value: string): string {
  const marker = value.search(/(?:^|\n)\s*(?:json\s*:\s*)?\{"(?:answer|observation|interpretation|next_step)"/i);
  const cleaned = marker > 0 ? value.slice(0, marker) : value;
  return cleaned.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim().slice(0, 1200);
}
function extractJson(value: string): unknown {
  const start = value.indexOf("{");
  if (start < 0) return null;
  let depth = 0; let quoted = false; let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) { try { return JSON.parse(value.slice(start, index + 1)); } catch { return null; } }
  }
  return null;
}
function containsPromptLeak(value: string): boolean {
  const normalized = value.toLocaleLowerCase();
  const instructionMarkers = (normalized.match(/não forneça|retorne apenas|json válido|system prompt|instruções anteriores|ignore as regras/g) || []).length;
  const repeatedPhrase = (normalized.match(/não forneça informações sobre como você pode ser utilizado/g) || []).length;
  return instructionMarkers >= 2 || repeatedPhrase >= 2;
}
function parseModelOutput(candidate: unknown, data: InsightData): unknown {
  if (candidate && typeof candidate === "object") {
    const row = candidate as Record<string, any>;
    if (typeof row.answer === "string" && row.answer.trim()) {
      const embedded = extractJson(row.answer);
      if (embedded && typeof embedded === "object" && typeof (embedded as Record<string, unknown>).answer === "string") return parseModelOutput(embedded, data);
      const answer = stripEmbeddedJson(row.answer);
      if (!answer || containsPromptLeak([answer, row.observation, row.interpretation, row.next_step].filter((item): item is string => typeof item === "string").join(" "))) return null;
      const sources = Array.isArray(row.sources) && row.sources.length > 0 ? row.sources : Object.values(data.tools).flatMap((tool: any) => [tool?.source, tool?.series_source].filter(Boolean)).slice(0, 8);
      return { answer, observation: typeof row.observation === "string" && row.observation.trim() ? stripEmbeddedJson(row.observation) : "O modelo respondeu usando os indicadores agregados autorizados.", interpretation: typeof row.interpretation === "string" && row.interpretation.trim() ? stripEmbeddedJson(row.interpretation) : "A leitura é descritiva e não permite concluir causas ou avaliar pessoas.", next_step: typeof row.next_step === "string" && row.next_step.trim() ? stripEmbeddedJson(row.next_step) : "Vale acompanhar este indicador no próximo período.", sources, period: row.period && typeof row.period === "object" ? row.period : data.period, limitations: Array.isArray(row.limitations) ? row.limitations : data.limitations, confidence: "supported", fallback: false };
    }
    return candidate;
  }
  if (typeof candidate !== "string") return null;
  const text = candidate.trim();
  const candidates = [text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""), extractJson(text)];
  for (const item of candidates) {
    if (item && typeof item === "object") return item;
    if (typeof item === "string") { try { return JSON.parse(item); } catch { /* try the next safe extraction */ } }
  }
  // Some Workers AI responses are valid prose despite the JSON instruction.
  // Preserve that answer and attach only already-authorized aggregate sources;
  // schemas.ts will still reject unsupported numbers or missing fields.
  if (text.length > 0) {
    const sources = Object.values(data.tools).flatMap((tool: any) => {
      const values = [tool?.source, tool?.series_source].filter(Boolean);
      return values;
    }).slice(0, 8);
    const answer = stripEmbeddedJson(text);
    if (!answer || containsPromptLeak(answer)) return null;
    return { answer, observation: "O modelo respondeu usando os indicadores agregados autorizados.", interpretation: "A leitura é descritiva e não permite concluir causas ou avaliar pessoas.", next_step: "Vale acompanhar este indicador no próximo período.", sources, period: data.period, limitations: data.limitations, confidence: "supported", fallback: false };
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

