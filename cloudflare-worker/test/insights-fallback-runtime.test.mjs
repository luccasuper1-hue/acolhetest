import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

test("guided Insights answers stay aligned with dashboard metrics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "acolhe-insights-"));
  try {
    const source = await readFile(new URL("../src/ai/fallback.ts", import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const modulePath = join(directory, "fallback.mjs");
    await writeFile(modulePath, compiled, "utf8");
    const { fallbackInsight } = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`);
    const data = {
      period: { start: "2026-11-13", end: "2026-11-22" },
      limitations: [],
      tools: {
        demand: { requests_total: 18, sample_size: 18, source: { metric: "requests_total", value: 18, sample_size: 18, origin: "métricas" } },
        response: { average_minutes: 45, sample_size: 14, source: { metric: "response_time_minutes_avg", value: 45, sample_size: 14, origin: "métricas" } },
        attendance: { rate_percent: 90, sample_size: 9, source: { metric: "attendance_rate", value: 90, sample_size: 9, origin: "métricas" } },
        impact: { available: false },
        capacity: { open_slots: 3, reserved_slots: 7, utilization_percent: 70, source: { metric: "capacity_utilization_percent", value: 70, sample_size: 10, origin: "métricas" } },
        bottlenecks: { pending_requests: 2, overdue_requests: 1, source: { metric: "operational_bottlenecks", value: 1, sample_size: 18, origin: "métricas" } },
      },
    };
    assert.match(fallbackInsight(data, "demand", "test").answer, /18 pedidos/);
    assert.match(fallbackInsight(data, "response_time", "test").answer, /45 minutos/);
    assert.match(fallbackInsight(data, "attendance", "test").answer, /90%/);
    assert.match(fallbackInsight(data, "impact", "test").answer, /linha de base ainda não foi registrada/);
    assert.match(fallbackInsight(data, "capacity", "test").answer, /3 horários livres/);
    assert.match(fallbackInsight(data, "bottlenecks", "test").answer, /1 pedido além de 48 horas/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
