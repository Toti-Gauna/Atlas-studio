/**
 * FIXTURE (P02 preview only): workflow runner with checkpoints.
 * Each poll of GET /workflow-runs/:id lets the "worker" process at most one
 * step — the UI highlights steps from this server state, never from timers.
 */
import type { WorkflowRun } from "@atlas/contracts";
import { CHECKLIST_ITEMS } from "@atlas/demo-seed";
import { aggregate, compareChecklist, dataReport, gapReport, presentationFromBrief, profileCsv } from "@atlas/domain";
import { iso, newId, type Db } from "../db";
import { authorizedChunks, currentAgentVersion, routeFor, taskForProfile } from "../scope";
import { createArtifact } from "./artifacts";
import { startRun } from "./runs";

export function startWorkflow(db: Db, workflowId: string, version: number, projectId: string, inputs: Record<string, string>, idempotencyKey: string): WorkflowRun {
  const existing = db.workflowRuns.find((r) => r.workflowId === workflowId && r.checkpoints[0]?.idempotencyKey.startsWith(`${idempotencyKey}:`));
  if (existing) return existing; // idempotent start
  const wf = db.workflows.find((w) => w.summary.id === workflowId)!;
  const v = wf.versions.find((x) => x.version === version)!;
  const first = v.steps[0]!;
  const run: WorkflowRun = {
    id: newId("wfr"),
    workflowId,
    workflowVersion: version,
    projectId,
    status: first.requiresConfirmation ? "awaiting_confirmation" : "running",
    currentStepKey: first.key,
    checkpoints: v.steps.map((s) => ({ stepKey: s.key, status: s === first && s.requiresConfirmation ? "awaiting_confirmation" : "pending", attempt: 0, idempotencyKey: `${idempotencyKey}:${s.key}`, outputSummary: null, artifactId: null, runId: null, finishedAt: null })),
    inputs,
    costNanoUsd: "0",
    costStatus: "no_provider_charge",
    startedAt: iso(Date.now()),
    updatedAt: iso(Date.now()),
  };
  db.workflowRuns.unshift(run);
  wf.summary.lastRunStatus = run.status;
  return run;
}

const pauseRequested = new Set<string>();

export function requestPause(db: Db, run: WorkflowRun): WorkflowRun {
  if (run.status === "running") pauseRequested.add(run.id);
  if (run.status === "awaiting_confirmation") run.status = "paused";
  return run;
}

export function resume(db: Db, run: WorkflowRun): WorkflowRun {
  if (run.status !== "paused" && run.status !== "failed") return run;
  pauseRequested.delete(run.id);
  const next = run.checkpoints.find((c) => c.status !== "succeeded" && c.status !== "skipped");
  if (!next) {
    run.status = "succeeded";
    return run;
  }
  const v = db.workflows.find((w) => w.summary.id === run.workflowId)!.versions.find((x) => x.version === run.workflowVersion)!;
  const def = v.steps.find((s) => s.key === next.stepKey)!;
  run.currentStepKey = next.stepKey;
  if (def.requiresConfirmation && next.status !== "succeeded") {
    next.status = "awaiting_confirmation";
    run.status = "awaiting_confirmation";
  } else {
    if (next.status === "failed" || next.status === "cancelled") next.status = "pending";
    run.status = "running";
  }
  run.updatedAt = iso(Date.now());
  return run;
}

export function confirmStep(db: Db, run: WorkflowRun): WorkflowRun {
  const cp = run.checkpoints.find((c) => c.status === "awaiting_confirmation");
  if (!cp) return run; // idempotent: already confirmed
  cp.status = "succeeded";
  cp.attempt += 1;
  cp.outputSummary = Object.entries(run.inputs).map(([k, v]) => `${k}: ${v}`).join(" · ") || "Confirmed";
  cp.finishedAt = iso(Date.now());
  const next = run.checkpoints.find((c) => c.status === "pending");
  run.currentStepKey = next?.stepKey ?? null;
  run.status = next ? "running" : "succeeded";
  run.updatedAt = iso(Date.now());
  return run;
}

/** Worker tick: execute one pending step. Effects are deduplicated by checkpoint idempotency key. */
export function tick(db: Db, run: WorkflowRun, userId: string): WorkflowRun {
  if (run.status !== "running") return run;
  const cp = run.checkpoints.find((c) => c.status === "pending" || c.status === "running");
  const wf = db.workflows.find((w) => w.summary.id === run.workflowId)!;
  const v = wf.versions.find((x) => x.version === run.workflowVersion)!;
  if (!cp) {
    run.status = "succeeded";
    run.currentStepKey = null;
    wf.summary.lastRunStatus = "succeeded";
    return run;
  }
  const def = v.steps.find((s) => s.key === cp.stepKey)!;
  if (def.requiresConfirmation) {
    cp.status = "awaiting_confirmation";
    run.status = "awaiting_confirmation";
    run.currentStepKey = cp.stepKey;
    return run;
  }
  cp.attempt += 1;
  run.currentStepKey = cp.stepKey;
  const agentVersion = currentAgentVersion(db, v.agentId)!;
  const agent = db.agents.find((a) => a.summary.id === v.agentId)!;
  const chunks = authorizedChunks(db, run.projectId, agentVersion.config);
  const csv = db.documents.find((d) => d.csvText && !d.deleted && d.summary.projectIds.includes(run.projectId));
  try {
    switch (def.tool) {
      case "retrieve_sources":
        cp.outputSummary = `${chunks.length} authorized passages from ${new Set(chunks.map((c) => c.documentId)).size} documents`;
        break;
      case "checklist_compare": {
        const f = compareChecklist(CHECKLIST_ITEMS, chunks.filter((c) => !/checklist/i.test(c.documentTitle)));
        cp.outputSummary = `${f.filter((x) => x.status === "covered").length} covered · ${f.filter((x) => x.status === "partial").length} partial · ${f.filter((x) => x.status === "gap").length} gaps`;
        break;
      }
      case "csv_profile":
      case "csv_stats": {
        if (!csv?.csvText) throw new Error("No CSV in this project.");
        const p = profileCsv(csv.csvText);
        cp.outputSummary = def.tool === "csv_profile" ? `${p.rowCount} rows × ${p.columnCount} columns · ${p.issues.length} issue(s)` : `Statistics for ${p.columns.filter((c) => c.numeric).length} numeric columns`;
        break;
      }
      case "csv_aggregate": {
        if (!csv?.csvText) throw new Error("No CSV in this project.");
        const g = run.inputs.groupBy || "region";
        const m = run.inputs.measure || "shipments";
        const a = aggregate(csv.csvText, g, m, "sum");
        cp.outputSummary = `sum(${m}) by ${g}: top ${a[0]?.group} ${Math.round(a[0]?.value ?? 0).toLocaleString("en-US")}`;
        break;
      }
      case "chart_spec":
        cp.outputSummary = "Bar chart spec from the aggregation table";
        break;
      case "outline_presentation":
        cp.outputSummary = `Outline for ${run.inputs.slides || 6} slides (template, local mode)`;
        break;
      case "draft_artifact": {
        const routing = routeFor(db, taskForProfile(agent.summary.profile), null, agentVersion.config.modelKey, ["text"]);
        const builder = startRun(db, { projectId: run.projectId, conversationId: null, workflowRunId: run.id, workflowVersionId: v.id, agentName: agent.summary.name, agentVersion, routing, objective: def.title, userId });
        let artId: string;
        if (wf.summary.recipe === "policy_review") {
          const f = compareChecklist(CHECKLIST_ITEMS, chunks.filter((c) => !/checklist/i.test(c.documentTitle)));
          const r = gapReport("Vendor checklist gap report", run.inputs.scope ?? "As supplied", run.inputs.jurisdiction ?? "As supplied", f);
          artId = createArtifact(db, { projectId: run.projectId, title: "Vendor checklist gap report", content: r.content, sources: r.sources, authorId: userId, runId: builder.run.id, idempotencyKey: cp.idempotencyKey }).summary.id;
        } else if (wf.summary.recipe === "csv_analysis") {
          const r = dataReport(csv!.summary.title, csv!.csvText!, run.inputs.groupBy || "region", run.inputs.measure || "shipments");
          artId = createArtifact(db, { projectId: run.projectId, title: r.content.title, content: r.content, sources: [], authorId: userId, runId: builder.run.id, idempotencyKey: cp.idempotencyKey }).summary.id;
        } else {
          const facts = chunks.slice(0, 8).map((c, i) => ({ text: c.text.split(/(?<=\.)\s+/)[0] ?? c.text, ref: `S${i + 1}`, c }));
          const deck = presentationFromBrief({ audience: run.inputs.audience || "Leadership", goal: run.inputs.goal || "Update", slideCount: Number(run.inputs.slides) || 6 }, facts);
          artId = createArtifact(db, {
            projectId: run.projectId,
            title: deck.title,
            content: deck,
            sources: facts.map((f) => ({ ref: f.ref, documentId: f.c.documentId, versionId: f.c.versionId, version: f.c.version, documentTitle: f.c.documentTitle, page: f.c.page, quote: f.text.slice(0, 600) })),
            authorId: userId,
            runId: builder.run.id,
            idempotencyKey: cp.idempotencyKey,
          }).summary.id;
        }
        builder.step("artifact_write", def.title, "succeeded", "Artifact written (idempotent by checkpoint key)", "draft_artifact");
        builder.finish("succeeded");
        cp.artifactId = artId;
        cp.runId = builder.run.id;
        cp.outputSummary = `Artifact ready: ${db.artifacts.find((a) => a.summary.id === artId)?.summary.title}`;
        break;
      }
      case "render_export":
        cp.outputSummary = "Export rendered from the current artifact version";
        break;
      default:
        cp.outputSummary = "Done";
    }
    cp.status = "succeeded";
    cp.finishedAt = iso(Date.now());
  } catch (e) {
    cp.status = "failed";
    cp.outputSummary = (e as Error).message;
    run.status = "failed";
    run.updatedAt = iso(Date.now());
    wf.summary.lastRunStatus = "failed";
    return run;
  }
  const next = run.checkpoints.find((c) => c.status === "pending");
  run.currentStepKey = next?.stepKey ?? null;
  if (!next) run.status = "succeeded";
  else if (pauseRequested.has(run.id)) {
    pauseRequested.delete(run.id);
    run.status = "paused";
  }
  run.updatedAt = iso(Date.now());
  wf.summary.lastRunStatus = run.status;
  return run;
}
