/**
 * FIXTURE (P02 preview only): DEMO usage ledger and budgets.
 * Synthetic usage objects are shaped like Anthropic Messages API `usage`
 * responses and priced with the verified price table via @atlas/domain.
 * They are labeled DEMO and are NOT real telemetry or billing.
 */
import type { LedgerEntry, RunDetail } from "@atlas/contracts";
import { mulberry32 } from "@atlas/demo-seed";
import { computeCost, findModel, normalizeAnthropicUsage, type AnthropicUsage } from "@atlas/domain";
import { iso, newId, type Db } from "./db";

const DAY = 86_400_000;

const MODELS = ["anthropic:claude-sonnet-5-5", "anthropic:claude-opus-5-5", "anthropic:claude-haiku-5-5"] as const;
const USERS = ["usr_visitor", "usr_leo", "usr_maya", "usr_priya"];

export function seedUsage(db: Db, ids: { projectIds: Record<string, string>; agentIds: Record<string, string> }) {
  const rand = mulberry32(9137);
  const projects = Object.values(ids.projectIds);
  const agents = Object.values(ids.agentIds);
  const entries: LedgerEntry[] = [];

  for (let i = 0; i < 64; i++) {
    const day = Math.floor(rand() * 30);
    const modelKey = MODELS[Math.floor(rand() * MODELS.length)]!;
    const model = findModel(modelKey)!;
    const projectId = projects[Math.floor(rand() * projects.length)]!;
    const agentId = agents[Math.floor(rand() * agents.length)]!;
    const userId = USERS[Math.floor(rand() * USERS.length)]!;
    const runId = newId("run");
    const cached = rand() > 0.45;
    const thinking = Math.round(rand() * 1800);
    const out = 300 + Math.round(rand() * 2400) + thinking;
    const scenario = i % 16 === 7 ? "cancelled" : i % 16 === 11 ? "failed_unknown" : i % 16 === 3 ? "retry" : "ok";
    const raw: AnthropicUsage = {
      input_tokens: 800 + Math.round(rand() * 9000),
      cache_creation_input_tokens: cached && rand() > 0.6 ? 4000 + Math.round(rand() * 6000) : 0,
      cache_read_input_tokens: cached ? 6000 + Math.round(rand() * 30000) : 0,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
      output_tokens: scenario === "cancelled" ? Math.round(out * 0.35) : out,
      output_tokens_details: { thinking_tokens: scenario === "cancelled" ? Math.round(thinking * 0.5) : thinking },
      server_tool_use: i % 9 === 0 ? { web_search_requests: 0 } : undefined,
    };
    raw.cache_creation!.ephemeral_5m_input_tokens = raw.cache_creation_input_tokens ?? 0;
    const occurred = db.now - day * DAY - Math.round(rand() * DAY * 0.8);
    const attempts: Array<{ status: LedgerEntry["status"]; usage: AnthropicUsage | null; requestId: string | null }> =
      scenario === "retry"
        ? [
            { status: "failed", usage: { ...raw, output_tokens: 0, output_tokens_details: { thinking_tokens: 0 } }, requestId: `req_demo_${i}_a` },
            { status: "succeeded", usage: raw, requestId: `req_demo_${i}_b` },
          ]
        : scenario === "failed_unknown"
          ? [{ status: "failed", usage: null, requestId: null }]
          : [{ status: scenario === "cancelled" ? "cancelled" : "succeeded", usage: raw, requestId: `req_demo_${i}` }];

    const run: RunDetail = {
      id: runId,
      projectId,
      conversationId: null,
      workflowRunId: null,
      agentId,
      agentName: db.agents.find((a) => a.summary.id === agentId)?.summary.name ?? "Agent",
      modelKey,
      mode: "connected",
      status: scenario === "cancelled" ? "cancelled" : scenario === "failed_unknown" ? "failed" : "succeeded",
      objective: "DEMO fixture run (synthetic usage)",
      startedAt: iso(occurred),
      finishedAt: iso(occurred + 4000),
      latencyMs: 0,
      costStatus: "calculated",
      costNanoUsd: "0",
      label: "DEMO",
      snapshot: {
        agentId,
        agentVersion: 1,
        agentConfig: db.agents.find((a) => a.summary.id === agentId)!.versions[0]!.config,
        modelKey,
        modelId: model.modelId,
        priceVersionId: model.currentPrice?.id ?? null,
        routing: { modelKey, source: "policy_rule", reason: "DEMO fixture", pendingFallback: null, blocked: null },
        documentVersions: [],
        memoryItemIds: [],
        projectId,
        workflowVersionId: null,
        configHash: "cfg_demo_fixture",
      },
      steps: [],
      attempts: [],
      disclaimer: "DEMO fixture: synthetic usage shaped like Anthropic API responses and priced with the verified price table. Not real telemetry, no provider was called.",
    };
    let total = 0n;
    let unknown = false;
    attempts.forEach((a, k) => {
      const latency = a.status === "failed" ? 900 + Math.round(rand() * 2000) : 2200 + Math.round(rand() * 9000);
      const norm = normalizeAnthropicUsage(a.usage);
      const cost = computeCost(norm.usage, model.currentPrice, norm.assumptions);
      if (cost.nanoUsd === null) unknown = true;
      else total += BigInt(cost.nanoUsd);
      const ledgerId = newId("led");
      const attemptId = newId("att");
      run.attempts.push({ id: attemptId, runId, stepId: null, attemptNumber: k + 1, modelKey, providerRequestId: a.requestId, status: a.status === "succeeded" ? "succeeded" : a.status, latencyMs: latency, ledgerEntryId: ledgerId, errorCode: a.status === "failed" ? "overloaded_error" : a.status === "cancelled" ? "CANCELLED" : null });
      run.latencyMs = (run.latencyMs ?? 0) + latency;
      entries.push({
        id: ledgerId,
        runId,
        attemptId,
        attemptNumber: k + 1,
        providerRequestId: a.requestId,
        provider: "anthropic",
        modelKey,
        modelId: model.modelId,
        requestType: i % 7 === 0 ? "workflow_step" : i % 11 === 0 ? "comparison" : "chat",
        agentId,
        projectId,
        userId,
        status: a.status,
        usage: norm.usage,
        priceVersionId: model.currentPrice?.id ?? null,
        costStatus: cost.status,
        costNanoUsd: cost.nanoUsd,
        breakdown: cost.lines,
        latencyMs: latency,
        label: "DEMO",
        occurredAt: iso(occurred + k * 3000),
      });
    });
    run.costStatus = unknown ? "unknown" : "calculated";
    run.costNanoUsd = unknown ? null : total.toString();
    run.steps.push({ id: newId("stp"), runId, ordinal: 0, kind: "model_call", title: "Model call (DEMO fixture)", status: run.status === "succeeded" ? "succeeded" : run.status === "cancelled" ? "cancelled" : "failed", tool: null, summary: `${attempts.length} attempt(s); synthetic usage`, startedAt: run.startedAt, finishedAt: run.finishedAt });
    db.runs.push(run);
  }
  db.ledger.push(...entries);
  db.ledger.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  db.runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const spent = (filter: (e: LedgerEntry) => boolean) =>
    db.ledger.filter((e) => filter(e) && e.costNanoUsd && db.now - Date.parse(e.occurredAt) < 30 * DAY).reduce((acc, e) => acc + BigInt(e.costNanoUsd!), 0n);
  const unknownCount = (filter: (e: LedgerEntry) => boolean) => db.ledger.filter((e) => filter(e) && e.costStatus === "unknown").length;
  const budget = (id: string, scope: "workspace" | "project" | "agent", scopeId: string, scopeLabel: string, limitUsd: number, filter: (e: LedgerEntry) => boolean, hardStop: boolean) => ({
    id,
    scope,
    scopeId,
    scopeLabel,
    period: "monthly" as const,
    limitNanoUsd: String(BigInt(Math.round(limitUsd * 1e9))),
    spentNanoUsd: spent(filter).toString(),
    reservedNanoUsd: "0",
    unknownCostEntries: unknownCount(filter),
    alertThresholdPct: 80,
    hardStop,
    updatedAt: iso(db.now - 4 * DAY),
  });
  db.budgets = [
    budget("bdg_workspace", "workspace", db.workspace.id, "Workspace (all projects)", 12, () => true, true),
    budget("bdg_compliance", "project", ids.projectIds.compliance!, "Vendor security review", 3, (e) => e.projectId === ids.projectIds.compliance, true),
    budget("bdg_analysis", "project", ids.projectIds.analysis!, "Q3 shipping performance", 2.5, (e) => e.projectId === ids.projectIds.analysis, false),
    budget("bdg_agent_deck", "agent", ids.agentIds["presentation-creator"]!, "Presentation Creator", 1.5, (e) => e.agentId === ids.agentIds["presentation-creator"], true),
  ];
}
