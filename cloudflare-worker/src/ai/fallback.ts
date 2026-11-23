import type { InsightData } from "./tools";
import type { InsightResponse } from "./schemas";
export function fallbackInsight(data: InsightData, intent: string, reason: string): InsightResponse {
  const tool = data.tools[intent === "response_time" ? "response" : intent] as Record<string, any> | undefined;
  const sample = Number(tool?.sample_size || 0);
  const ready = sample >= 5;
  let answer = "Com os dados disponíveis, ainda não há amostra suficiente para interpretar este indicador.";
  if (ready && intent === "attendance" && tool?.rate_percent != null) answer = `O comparecimento agregado foi de ${tool.rate_percent}%.`;
  if (ready && intent === "attendance" && tool?.rate_percent == null) answer = `Há ${sample} registros de comparecimento no período, mas a taxa ainda não está disponível.`;
  if (ready && intent === "response" && tool?.average_minutes != null) answer = `O tempo médio até resposta foi de ${Math.round(tool.average_minutes)} minutos.`;
  if (ready && intent === "response" && tool?.average_minutes == null) answer = `Há ${sample} respostas registradas no período, mas o tempo médio ainda não está disponível.`;
  if (intent === "demand" && (data.tools.demand as any)?.requests_total != null) answer = `Foram registrados ${Number((data.tools.demand as any).requests_total)} pedidos no período observado.`;
  const source = tool?.source && ready ? [{ ...tool.source, origin: tool.source.origin || "métrica agregada da instituição" }] : (intent === "demand" && (data.tools.demand as any).source ? [{ ...(data.tools.demand as any).source, origin: "métrica agregada da instituição" }] : []);
  const observation = ready ? `Há ${sample} registros agregados no período, suficientes para uma leitura operacional inicial.` : "Ainda não há registros agregados suficientes para uma leitura responsável.";
  const interpretation = ready ? "O dado descreve o período observado; sozinho, não explica causas nem permite avaliar pessoas." : "Há sinais iniciais, mas a amostra ainda é pequena para uma interpretação segura.";
  const next_step = ready ? "Vale acompanhar este indicador no próximo período e revisar a capacidade publicada se necessário." : "Vale acompanhar os próximos períodos até que haja observações válidas suficientes.";
  return { answer, observation, interpretation, next_step, sources: source, period: data.period, limitations: [reason, ...data.limitations], confidence: "fallback", fallback: true };
}
