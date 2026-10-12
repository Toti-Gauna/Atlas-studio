/** FIXTURE (P02 preview only): workflows, FinOps, tickets, evaluations and showcase. */
import type { Budget, Ticket, UsageQuery, WorkflowStepDef } from "@atlas/contracts";
import { toolById } from "@atlas/domain";
import { iso, newId } from "../db";
import { body, FixtureError, notFound, on, requireAction, type Ctx } from "../router";
import { confirmStep, requestPause, resume, startWorkflow, tick } from "../engine/workflow";
import { filterLedger, ledgerCsv, usageReport } from "../engine/usage";
import { runEvaluation } from "../engine/evaluation";
import { routeFor, taskForProfile } from "../scope";

const getWf = (ctx: Ctx, id: string) => ctx.db.workflows.find((w) => w.summary.id === id) ?? notFound("Workflow");
const getWfRun = (ctx: Ctx, id: string) => ctx.db.workflowRuns.find((r) => r.id === id) ?? notFound("Workflow run");

on("GET", "/workflows", (ctx) => {
  requireAction(ctx, "workflow.read");
  return ctx.db.workflows.map((w) => w.summary);
});
on("GET", "/workflows/:id", (ctx) => {
  requireAction(ctx, "workflow.read");
  const w = getWf(ctx, ctx.params.id!);
  return { ...w.summary, versions: w.versions, current: w.versions.find((v) => v.version === w.summary.currentVersion)! };
});
on("PUT", "/workflows/:id", (ctx) => {
  requireAction(ctx, "workflow.write");
  const w = getWf(ctx, ctx.params.id!);
  const b = body<{ baseVersion: number; steps: WorkflowStepDef[]; changeNote: string }>(ctx);
  if (b.baseVersion !== w.summary.currentVersion) throw new FixtureError("CONFLICT", `Workflow is now v${w.summary.currentVersion}. Reload before saving.`);
  if (!b.steps.length) throw new FixtureError("VALIDATION", "A workflow needs at least one step.");
  const keys = new Set<string>();
  for (const s of b.steps) {
    if (keys.has(s.key)) throw new FixtureError("VALIDATION", `Duplicate step key ${s.key}.`);
    keys.add(s.key);
    if (s.tool) toolById(s.tool);
  }
  const current = w.versions.find((v) => v.version === w.summary.currentVersion)!;
  const version = w.summary.currentVersion + 1;
  w.versions.push({ id: newId("wfv"), workflowId: w.summary.id, version, agentId: current.agentId, steps: b.steps, changeNote: b.changeNote || "Edited steps", createdAt: iso(Date.now()) });
  Object.assign(w.summary, { currentVersion: version, stepCount: b.steps.length, updatedAt: iso(Date.now()) });
  return { ...w.summary, versions: w.versions, current: w.versions.at(-1)! };
});
on("POST", "/workflows/:id/preview", (ctx) => {
  requireAction(ctx, "workflow.read");
  const w = getWf(ctx, ctx.params.id!);
  const v = w.versions.find((x) => x.version === w.summary.currentVersion)!;
  const agent = ctx.db.agents.find((a) => a.summary.id === v.agentId)!;
  const routing = routeFor(ctx.db, taskForProfile(agent.summary.profile), null, agent.summary.modelKey, ["text"]);
  return {
    agentId: agent.summary.id,
    agentVersion: agent.summary.currentVersion,
    steps: v.steps.map((s) => ({ title: s.title, tool: s.tool, effect: s.effect === "none" ? (s.requiresConfirmation ? "waits for your confirmation" : "no side effects") : s.effect.replace(/_/g, " "), invokesModel: s.invokesModel })),
    routing,
    estimate: { inputTokens: null, outputTokens: null, costNanoUsd: "0", basis: "Local adapter: no provider charge. Model-backed steps would reserve budget before each call." },
    requiresConfirmation: v.steps.some((s) => s.requiresConfirmation),
    confirmationReasons: v.steps.filter((s) => s.requiresConfirmation).map((s) => `“${s.title}” waits for your confirmation.`),
    missingBrief: [],
  };
});
on("POST", "/workflows/:id/runs", (ctx) => {
  requireAction(ctx, "workflow.run");
  const w = getWf(ctx, ctx.params.id!);
  const b = body<{ projectId: string; version: number; inputs: Record<string, string>; idempotencyKey: string }>(ctx);
  if (!w.versions.some((v) => v.version === b.version)) notFound("Workflow version");
  return startWorkflow(ctx.db, w.summary.id, b.version, b.projectId, b.inputs, b.idempotencyKey);
});
on("GET", "/workflows/:id/runs", (ctx) => ctx.db.workflowRuns.filter((r) => r.workflowId === ctx.params.id));
/** Each poll lets the preview worker process one step; the UI renders exactly this state. */
on("GET", "/workflow-runs/:id", (ctx) => tick(ctx.db, getWfRun(ctx, ctx.params.id!), ctx.userId));
on("POST", "/workflow-runs/:id/pause", (ctx) => {
  requireAction(ctx, "workflow.run");
  return requestPause(ctx.db, getWfRun(ctx, ctx.params.id!));
});
on("POST", "/workflow-runs/:id/resume", (ctx) => {
  requireAction(ctx, "workflow.run");
  return resume(ctx.db, getWfRun(ctx, ctx.params.id!));
});
on("POST", "/workflow-runs/:id/confirm", (ctx) => {
  requireAction(ctx, "workflow.run");
  return confirmStep(ctx.db, getWfRun(ctx, ctx.params.id!));
});

// FinOps (R09)
on("GET", "/usage", (ctx) => {
  requireAction(ctx, "usage.read");
  return usageReport(ctx.db, { range: (ctx.query.range as "7d" | "30d") ?? "30d", groupBy: (ctx.query.groupBy as UsageQuery["groupBy"]) ?? "model", provider: ctx.query.provider as UsageQuery["provider"], modelKey: ctx.query.modelKey, agentId: ctx.query.agentId, projectId: ctx.query.projectId, userId: ctx.query.userId });
});
on("GET", "/usage/ledger", (ctx) => {
  requireAction(ctx, "usage.read");
  const items = filterLedger(ctx.db, { range: (ctx.query.range as "7d" | "30d") ?? "30d", modelKey: ctx.query.modelKey }).filter((e) => !ctx.query.runId || e.runId === ctx.query.runId);
  return { items: items.slice(0, 100), nextCursor: null };
});
export function usageExport(ctx: Ctx) {
  requireAction(ctx, "budget.admin");
  const csv = ledgerCsv(filterLedger(ctx.db, { range: (ctx.query.range as "7d" | "30d") ?? "30d" }));
  return { blob: new Blob([csv], { type: "text/csv" }), filename: `atlas-usage-${ctx.query.range ?? "30d"}-DEMO.csv` };
}
on("GET", "/budgets", (ctx) => {
  requireAction(ctx, "project.read");
  return ctx.db.budgets;
});
on("PUT", "/budgets/:id", (ctx) => {
  requireAction(ctx, "budget.admin");
  const bdg = ctx.db.budgets.find((x) => x.id === ctx.params.id) ?? notFound("Budget");
  const b = body<Pick<Budget, "limitNanoUsd" | "alertThresholdPct" | "hardStop">>(ctx);
  if (!/^\d+$/.test(b.limitNanoUsd)) throw new FixtureError("VALIDATION", "Limit must be a positive amount.");
  Object.assign(bdg, { limitNanoUsd: b.limitNanoUsd, alertThresholdPct: b.alertThresholdPct, hardStop: b.hardStop, updatedAt: iso(Date.now()) });
  return bdg;
});

// Support desk (núcleo)
const getTicket = (ctx: Ctx, id: string): Ticket => {
  const t = ctx.db.tickets.find((x) => x.id === id);
  const conv = t && ctx.db.conversations.find((c) => c.summary.id === t.conversationId);
  if (!t || (ctx.role === "customer" && conv?.customerId !== ctx.userId)) notFound("Ticket");
  return t;
};
on("GET", "/tickets", (ctx) => {
  if (ctx.role === "customer") return ctx.db.tickets.filter((t) => ctx.db.conversations.find((c) => c.summary.id === t.conversationId)?.customerId === ctx.userId);
  requireAction(ctx, "ticket.inbox");
  return ctx.db.tickets;
});
on("GET", "/tickets/:id", (ctx) => getTicket(ctx, ctx.params.id!));
on("POST", "/tickets/:id/replies", (ctx) => {
  requireAction(ctx, "ticket.reply_own");
  const t = getTicket(ctx, ctx.params.id!);
  const { body: text } = body<{ body: string }>(ctx);
  if (!text?.trim()) throw new FixtureError("VALIDATION", "Reply is empty.");
  t.replies.push({ id: newId("rpl"), ticketId: t.id, authorId: ctx.userId, authorName: ctx.role === "customer" ? "Dana Whitfield" : "Demo Visitor", authorRole: ctx.role === "customer" ? "customer" : "operator", body: text.trim().slice(0, 4000), createdAt: iso(Date.now()) });
  if (ctx.role !== "customer" && t.status === "open") t.status = "pending_customer";
  t.updatedAt = iso(Date.now());
  return t;
});
on("PATCH", "/tickets/:id/status", (ctx) => {
  requireAction(ctx, "ticket.inbox");
  const t = getTicket(ctx, ctx.params.id!);
  t.status = body<{ status: Ticket["status"] }>(ctx).status;
  t.updatedAt = iso(Date.now());
  const conv = ctx.db.conversations.find((c) => c.summary.id === t.conversationId);
  if (conv) conv.summary.hasOpenTicket = t.status === "open" || t.status === "pending_customer";
  return t;
});
on("PATCH", "/tickets/:id/assignment", (ctx) => {
  requireAction(ctx, "ticket.inbox");
  const t = getTicket(ctx, ctx.params.id!);
  const { assigneeId } = body<{ assigneeId: string | null }>(ctx);
  t.assigneeId = assigneeId;
  t.assigneeName = assigneeId ? (ctx.db.users.find((u) => u.id === assigneeId)?.displayName ?? null) : null;
  t.updatedAt = iso(Date.now());
  return t;
});

on("GET", "/evaluations/suites", (ctx) => {
  requireAction(ctx, "usage.read");
  return [{ ...ctx.db.evalSuite, runs: ctx.db.evalRuns.map(({ results: _r, ...r }) => r), label: "DEMO" }];
});
on("POST", "/evaluations/runs", (ctx) => {
  requireAction(ctx, "evaluation.run");
  return runEvaluation(ctx.db);
});
on("GET", "/evaluations/runs/:id/results", (ctx) => {
  requireAction(ctx, "usage.read");
  return ctx.db.evalRuns.find((r) => r.id === ctx.params.id) ?? notFound("Evaluation run");
});

on("GET", "/demo/scenarios", (ctx) =>
  ctx.db.showcase.map((s) => {
    const runs = ctx.db.workflowRuns.filter((r) => r.workflowId === s.workflowId);
    const last = runs[0];
    return {
      ...s,
      lastRun: last ? { workflowRunId: last.id, status: last.status, artifactIds: last.checkpoints.map((c) => c.artifactId).filter((x): x is string => Boolean(x)), finishedAt: last.status === "succeeded" ? last.updatedAt : null } : null,
    };
  }),
);
