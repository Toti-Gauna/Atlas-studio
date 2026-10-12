/** FIXTURE (P02 preview only): usage aggregation mirroring GET /usage. */
import type { LedgerEntry, UsageGroup, UsageQuery, UsageReport } from "@atlas/contracts";
import { toCsv } from "@atlas/domain";
import { iso, type Db } from "../db";

const DAY = 86_400_000;

function emptyGroup(): Omit<UsageGroup, "key" | "label"> & { latencies: number[]; runIds: Set<string> } {
  return {
    runs: 0,
    attempts: 0,
    failedOrCancelled: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    thinkingTokensReported: 0,
    calculatedNanoUsd: "0",
    unknownCostEntries: 0,
    localEntries: 0,
    p50LatencyMs: null,
    latencies: [],
    runIds: new Set(),
  };
}

function add(g: ReturnType<typeof emptyGroup>, e: LedgerEntry) {
  g.attempts += 1;
  g.runIds.add(e.runId);
  if (e.status !== "succeeded") g.failedOrCancelled += 1;
  g.inputTokens += e.usage.inputUncachedTokens ?? 0;
  g.outputTokens += e.usage.outputTokens ?? 0;
  g.cacheReadTokens += e.usage.cacheReadTokens ?? 0;
  g.cacheWriteTokens += (e.usage.cacheWrite5mTokens ?? 0) + (e.usage.cacheWrite1hTokens ?? 0);
  g.thinkingTokensReported += e.usage.thinkingTokensReported ?? 0;
  if (e.costStatus === "unknown") g.unknownCostEntries += 1;
  else if (e.costStatus === "no_provider_charge") g.localEntries += 1;
  else if (e.costNanoUsd) g.calculatedNanoUsd = (BigInt(g.calculatedNanoUsd) + BigInt(e.costNanoUsd)).toString();
  if (e.latencyMs !== null) g.latencies.push(e.latencyMs);
}

function finalize(key: string, label: string, g: ReturnType<typeof emptyGroup>): UsageGroup {
  const sorted = [...g.latencies].sort((a, b) => a - b);
  const { latencies: _l, runIds, ...rest } = g;
  return { ...rest, key, label, runs: runIds.size, p50LatencyMs: sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : null };
}

export function filterLedger(db: Db, q: Partial<UsageQuery> & { range: "7d" | "30d" }): LedgerEntry[] {
  const from = Date.now() - (q.range === "7d" ? 7 : 30) * DAY;
  return db.ledger.filter(
    (e) =>
      Date.parse(e.occurredAt) >= from &&
      (!q.provider || e.provider === q.provider) &&
      (!q.modelKey || e.modelKey === q.modelKey) &&
      (!q.agentId || e.agentId === q.agentId) &&
      (!q.projectId || e.projectId === q.projectId) &&
      (!q.userId || e.userId === q.userId),
  );
}

export function usageReport(db: Db, q: UsageQuery): UsageReport {
  const entries = filterLedger(db, q);
  const groups = new Map<string, ReturnType<typeof emptyGroup>>();
  const labels = new Map<string, string>();
  const total = emptyGroup();
  const keyOf = (e: LedgerEntry): [string, string] => {
    switch (q.groupBy) {
      case "model":
        return [e.modelKey, e.modelKey.split(":")[1] ?? e.modelKey];
      case "agent":
        return [e.agentId ?? "none", db.agents.find((a) => a.summary.id === e.agentId)?.summary.name ?? "No agent"];
      case "project":
        return [e.projectId, db.projects.find((p) => p.id === e.projectId)?.name ?? e.projectId];
      case "user":
        return [e.userId, db.users.find((u) => u.id === e.userId)?.displayName ?? e.userId];
      case "provider":
        return [e.provider, e.provider];
      case "day":
        return [e.occurredAt.slice(0, 10), e.occurredAt.slice(0, 10)];
    }
  };
  for (const e of entries) {
    const [k, label] = keyOf(e);
    labels.set(k, label);
    const g = groups.get(k) ?? emptyGroup();
    add(g, e);
    groups.set(k, g);
    add(total, e);
  }
  const days = q.range === "7d" ? 7 : 30;
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * DAY).toISOString().slice(0, 10);
    const es = entries.filter((e) => e.occurredAt.startsWith(day));
    return {
      day,
      calculatedNanoUsd: es.reduce((acc, e) => (e.costNanoUsd && e.costStatus !== "no_provider_charge" ? acc + BigInt(e.costNanoUsd) : acc), 0n).toString(),
      unknownCostEntries: es.filter((e) => e.costStatus === "unknown").length,
      localEntries: es.filter((e) => e.costStatus === "no_provider_charge").length,
    };
  });
  const { key: _k, label: _lb, ...totals } = finalize("total", "Total", total);
  return {
    query: q,
    from: iso(Date.now() - days * DAY),
    to: iso(Date.now()),
    groups: [...groups.entries()].map(([k, g]) => finalize(k, labels.get(k) ?? k, g)).sort((a, b) => Number(BigInt(b.calculatedNanoUsd) - BigInt(a.calculatedNanoUsd))),
    totals,
    daily,
    label: "DEMO",
    disclaimer:
      "DEMO fixture data. Costs of Atlas API calls only — not Claude Max, ChatGPT or development costs. Calculated costs use the verified price snapshot; unknown costs are shown separately and never counted as zero. Not a reconciled invoice.",
  };
}

export function ledgerCsv(entries: LedgerEntry[]): string {
  return toCsv(
    ["occurred_at", "run_id", "attempt", "provider_request_id", "provider", "model", "status", "input_uncached", "cache_write", "cache_read", "output", "thinking_reported", "cost_status", "cost_usd", "label"],
    entries.map((e) => [
      e.occurredAt,
      e.runId,
      e.attemptNumber,
      e.providerRequestId,
      e.provider,
      e.modelId,
      e.status,
      e.usage.inputUncachedTokens,
      (e.usage.cacheWrite5mTokens ?? 0) + (e.usage.cacheWrite1hTokens ?? 0),
      e.usage.cacheReadTokens,
      e.usage.outputTokens,
      e.usage.thinkingTokensReported,
      e.costStatus,
      e.costNanoUsd === null ? null : (Number(BigInt(e.costNanoUsd)) / 1e9).toFixed(6),
      e.label,
    ]),
  );
}
