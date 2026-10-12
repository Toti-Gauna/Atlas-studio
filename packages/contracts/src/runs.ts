import { z } from "zod";
import { DataLabel, Id, IsoDateTime, NanoUsd } from "./common";
import { AgentConfig, ToolId } from "./agents";
import { RoutingDecision } from "./models";

export const RunStatus = z.enum([
  "planned",
  "awaiting_confirmation",
  "running",
  "succeeded",
  "abstained",
  "failed",
  "cancelled",
  "blocked",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const RunStepKind = z.enum([
  "plan",
  "privacy_check",
  "budget_reservation",
  "retrieval",
  "tool_call",
  "model_call",
  "artifact_write",
  "confirmation",
  "review",
]);

export const RunStep = z.object({
  id: Id,
  runId: Id,
  ordinal: z.number().int().nonnegative(),
  kind: RunStepKind,
  title: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed", "skipped", "cancelled", "denied"]),
  tool: ToolId.nullable(),
  /** Operational summary only — never private chain-of-thought. */
  summary: z.string().nullable(),
  startedAt: IsoDateTime.nullable(),
  finishedAt: IsoDateTime.nullable(),
});
export type RunStep = z.infer<typeof RunStep>;

export const AttemptStatus = z.enum(["reserved", "in_flight", "succeeded", "failed", "cancelled", "released"]);

export const RunAttempt = z.object({
  id: Id,
  runId: Id,
  stepId: Id.nullable(),
  attemptNumber: z.number().int().positive(),
  modelKey: z.string(),
  providerRequestId: z.string().nullable(),
  status: AttemptStatus,
  latencyMs: z.number().int().nonnegative().nullable(),
  ledgerEntryId: Id.nullable(),
  errorCode: z.string().nullable(),
});
export type RunAttempt = z.infer<typeof RunAttempt>;

/** Frozen configuration used by a run — survives later edits to agents, sources and prices. */
export const RunSnapshot = z.object({
  agentId: Id,
  agentVersion: z.number().int().positive(),
  agentConfig: AgentConfig,
  modelKey: z.string(),
  modelId: z.string().nullable(),
  priceVersionId: Id.nullable(),
  routing: RoutingDecision,
  documentVersions: z.array(z.object({ documentId: Id, versionId: Id, version: z.number().int().positive(), title: z.string() })),
  memoryItemIds: z.array(Id),
  projectId: Id,
  workflowVersionId: Id.nullable(),
  configHash: z.string(),
});
export type RunSnapshot = z.infer<typeof RunSnapshot>;

export const RunSummary = z.object({
  id: Id,
  projectId: Id,
  conversationId: Id.nullable(),
  workflowRunId: Id.nullable(),
  agentId: Id,
  agentName: z.string(),
  modelKey: z.string(),
  mode: z.enum(["local", "connected"]),
  status: RunStatus,
  objective: z.string(),
  startedAt: IsoDateTime,
  finishedAt: IsoDateTime.nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  costStatus: z.enum(["no_provider_charge", "calculated", "estimated", "unknown", "reconciled"]),
  costNanoUsd: NanoUsd.nullable(),
  /** DEMO = seeded/fixture record; LIVE = real execution telemetry. */
  label: DataLabel,
});
export type RunSummary = z.infer<typeof RunSummary>;

export const RunDetail = RunSummary.extend({
  snapshot: RunSnapshot,
  steps: z.array(RunStep),
  attempts: z.array(RunAttempt),
  disclaimer: z.string(),
});
export type RunDetail = z.infer<typeof RunDetail>;

export const PlanPreview = z.object({
  agentId: Id,
  agentVersion: z.number().int().positive(),
  steps: z.array(z.object({ title: z.string(), tool: ToolId.nullable(), effect: z.string(), invokesModel: z.boolean() })),
  routing: RoutingDecision,
  estimate: z.object({
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    costNanoUsd: NanoUsd.nullable(),
    basis: z.string(),
  }),
  requiresConfirmation: z.boolean(),
  confirmationReasons: z.array(z.string()),
  missingBrief: z.array(z.string()),
});
export type PlanPreview = z.infer<typeof PlanPreview>;
