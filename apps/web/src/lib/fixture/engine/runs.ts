/** FIXTURE (P02 preview only): run records, steps and ledger entries for local runs. */
import type { AgentVersion, LedgerEntry, RoutingDecision, RunDetail, RunStep, RunSummary } from "@atlas/contracts";
import { findModel } from "@atlas/domain";
import { iso, newId, type Db } from "../db";
import { activeMemoryIds, hashConfig } from "../scope";

export interface RunBuilder {
  run: RunDetail;
  step(kind: RunStep["kind"], title: string, status: RunStep["status"], summary: string | null, tool?: RunStep["tool"]): RunStep;
  finish(status: RunSummary["status"]): RunDetail;
}

export function startRun(
  db: Db,
  opts: {
    projectId: string;
    conversationId: string | null;
    workflowRunId?: string | null;
    workflowVersionId?: string | null;
    agentName: string;
    agentVersion: AgentVersion;
    routing: RoutingDecision;
    objective: string;
    userId: string;
    documentIds?: string[];
  },
): RunBuilder {
  const model = findModel(opts.routing.modelKey);
  const started = performance.now();
  const docs = db.documents
    .filter((d) => !d.deleted && d.summary.projectIds.includes(opts.projectId))
    .filter((d) => !opts.documentIds || opts.documentIds.includes(d.summary.id))
    .flatMap((d) => {
      const v = d.versions.find((x) => x.published);
      return v ? [{ documentId: d.summary.id, versionId: v.id, version: v.version, title: d.summary.title }] : [];
    });
  const id = newId("run");
  const run: RunDetail = {
    id,
    projectId: opts.projectId,
    conversationId: opts.conversationId,
    workflowRunId: opts.workflowRunId ?? null,
    agentId: opts.agentVersion.agentId,
    agentName: opts.agentName,
    modelKey: opts.routing.modelKey,
    mode: model?.provider === "local" ? "local" : "connected",
    status: "running",
    objective: opts.objective.slice(0, 240),
    startedAt: iso(Date.now()),
    finishedAt: null,
    latencyMs: null,
    costStatus: "no_provider_charge",
    costNanoUsd: "0",
    label: "DEMO",
    snapshot: {
      agentId: opts.agentVersion.agentId,
      agentVersion: opts.agentVersion.version,
      agentConfig: structuredClone(opts.agentVersion.config),
      modelKey: opts.routing.modelKey,
      modelId: model?.modelId ?? null,
      priceVersionId: model?.currentPrice?.id ?? null,
      routing: opts.routing,
      documentVersions: docs,
      memoryItemIds: activeMemoryIds(db, opts.projectId, opts.userId),
      projectId: opts.projectId,
      workflowVersionId: opts.workflowVersionId ?? null,
      configHash: "",
    },
    steps: [],
    attempts: [],
    disclaimer:
      "Shows operational steps and summarized tool results only — no private reasoning. Re-running the same configuration may not produce an identical answer once a generative model is connected.",
  };
  run.snapshot.configHash = hashConfig({ a: run.snapshot.agentConfig, m: run.snapshot.modelKey, d: docs.map((d) => d.versionId), mem: run.snapshot.memoryItemIds });
  db.runs.unshift(run);

  return {
    run,
    step(kind, title, status, summary, tool = null) {
      const now = iso(Date.now());
      const s: RunStep = { id: newId("stp"), runId: id, ordinal: run.steps.length, kind, title, status, tool, summary, startedAt: now, finishedAt: status === "running" || status === "pending" ? null : now };
      run.steps.push(s);
      return s;
    },
    finish(status) {
      const latency = Math.max(1, Math.round(performance.now() - started));
      run.status = status;
      run.finishedAt = iso(Date.now());
      run.latencyMs = latency;
      if (status !== "blocked") recordLocalAttempt(db, run, opts.userId, latency, status === "cancelled" ? "cancelled" : status === "failed" ? "failed" : "succeeded");
      return run;
    },
  };
}

/** Local adapter: an attempt + a ledger entry with "no provider charge" (distinct from unknown). */
export function recordLocalAttempt(db: Db, run: RunDetail, userId: string, latencyMs: number, status: LedgerEntry["status"], requestType: LedgerEntry["requestType"] = "chat") {
  const attemptId = newId("att");
  const ledgerId = newId("led");
  const model = findModel(run.modelKey);
  run.attempts.push({
    id: attemptId,
    runId: run.id,
    stepId: null,
    attemptNumber: run.attempts.length + 1,
    modelKey: run.modelKey,
    providerRequestId: null,
    status: status === "succeeded" ? "succeeded" : status,
    latencyMs,
    ledgerEntryId: ledgerId,
    errorCode: status === "failed" ? "INTERNAL" : null,
  });
  db.ledger.unshift({
    id: ledgerId,
    runId: run.id,
    attemptId,
    attemptNumber: run.attempts.length,
    providerRequestId: null,
    provider: model?.provider ?? "local",
    modelKey: run.modelKey,
    modelId: model?.modelId ?? null,
    requestType,
    agentId: run.agentId,
    projectId: run.projectId,
    userId,
    status,
    usage: {
      inputUncachedTokens: null,
      cacheWrite5mTokens: null,
      cacheWrite1hTokens: null,
      cacheReadTokens: null,
      outputTokens: null,
      thinkingTokensReported: null,
      thinkingIncludedInOutput: null,
      toolRequests: {},
      promptTokensForTier: null,
    },
    priceVersionId: model?.currentPrice?.id ?? null,
    costStatus: "no_provider_charge",
    costNanoUsd: "0",
    breakdown: [],
    latencyMs,
    label: "DEMO",
    occurredAt: iso(Date.now()),
  });
}

export function summarize(run: RunDetail): RunSummary {
  const { snapshot: _s, steps: _st, attempts: _a, disclaimer: _d, ...summary } = run;
  return summary;
}
