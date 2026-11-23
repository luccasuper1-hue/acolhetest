import type { InsightData } from "./tools";
import type { InsightResponse } from "./schemas";
export function fallbackInsight(data: InsightData, intent: string, reason: string): InsightResponse {
  const tool = data.tools[intent === "response_time" ? "response" : intent] as Record<string, any> | undefined;
  const sample = Number(tool?.sample_size || 0);
  const ready = sample >= 5;
  const operationalData = ready || ["impact", "capacity", "bottlenecks"].includes(intent);
  const responseIntent = intent === "response" || intent === "response_time";
  let answer = "Com os dados disponíveis, ainda não há amostra suficiente para interpretar este indicador.";
  if (intent === "general_scope") answer = "Posso conversar sobre o Acolhe, explicar os fluxos e políticas do projeto ou interpretar os indicadores operacionais permitidos. A IA está indisponível neste momento, mas você pode tentar novamente em instantes.";
  if (intent === "impact") answer = (data.tools.impact as any)?.available ? "A linha de base está disponível para comparar a evolução dos indicadores." : "A linha de base ainda não foi registrada; registre-a para acompanhar o que mudou ao longo do piloto.";
  if (intent === "capacity") {
    const open = Number((tool as any)?.open_slots || 0); const reserved = Number((tool as any)?.reserved_slots || 0);
    answer = (tool as any)?.utilization_percent == null ? `Há ${open} horários livres e ${reserved} reservados no período observado.` : `A utilização da capacidade está em ${(tool as any).utilization_percent}%, com ${open} horários livres.`;
  }
  if (intent === "bottlenecks") {
    const pending = Number((tool as any)?.pending_requests || 0); const overdue = Number((tool as any)?.overdue_requests || 0);
    const overdueLabel = `${overdue} ${overdue === 1 ? "pedido" : "pedidos"}`; const pendingLabel = `${pending} ${pending === 1 ? "pedido" : "pedidos"}`;
    answer = overdue > 0 ? `Há ${overdueLabel} além de 48 horas e ${pendingLabel} pendentes.` : `Há ${pendingLabel} pendentes; não foram identificados pedidos além de 48 horas.`;
  }
  if (ready && intent === "attendance" && tool?.rate_percent != null) answer = `O comparecimento agregado foi de ${tool.rate_percent}%.`;
  if (ready && intent === "attendance" && tool?.rate_percent == null) answer = `Há ${sample} registros de comparecimento no período, mas a taxa ainda não está disponível.`;
  if (ready && responseIntent && tool?.average_minutes != null) answer = `O tempo médio até resposta foi de ${Math.round(tool.average_minutes)} minutos.`;
  if (ready && responseIntent && tool?.average_minutes == null) answer = `Há ${sample} respostas registradas no período, mas o tempo médio ainda não está disponível.`;
  if (intent === "demand" && (data.tools.demand as any)?.requests_total != null) answer = `Foram registrados ${Number((data.tools.demand as any).requests_total)} pedidos no período observado.`;
  const source = tool?.source && operationalData ? [{ ...tool.source, origin: tool.source.origin || "métrica agregada da instituição" }] : (intent === "demand" && (data.tools.demand as any).source ? [{ ...(data.tools.demand as any).source, origin: "métrica agregada da instituição" }] : []);
  const observation = operationalData ? (sample ? `Há ${sample} registros agregados no período, suficientes para uma leitura operacional inicial.` : "Há indicadores operacionais agregados disponíveis para esta leitura.") : "Ainda não há registros agregados suficientes para uma leitura responsável.";
  const interpretation = operationalData ? "O dado descreve o período observado; sozinho, não explica causas nem permite avaliar pessoas." : "Há sinais iniciais, mas a amostra ainda é pequena para uma interpretação segura.";
  const next_step = operationalData ? "Vale acompanhar este indicador no próximo período e revisar a capacidade publicada se necessário." : "Vale acompanhar os próximos períodos até que haja observações válidas suficientes.";
  return { answer, observation, interpretation, next_step, sources: source, period: data.period, limitations: [reason, ...data.limitations], confidence: "fallback", fallback: true };
}
