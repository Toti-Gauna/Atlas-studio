import { z } from "zod";
import { DataLabel, Id, IsoDateTime, NanoUsd } from "./common";
import { ToolId } from "./agents";

export const WorkflowStepDef = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/),
  title: z.string().min(1).max(120),
  tool: ToolId.nullable(),
  invokesModel: z.boolean(),
  requiresConfirmation: z.boolean(),
  /** Steps with internal effects carry an idempotency scope so retries never duplicate them. */
  effect: z.enum(["none", "creates_artifact", "updates_artifact", "creates_ticket"]),
  inputHint: z.string().max(300),
});
export type WorkflowStepDef = z.infer<typeof WorkflowStepDef>;

export const WorkflowVersion = z.object({
  id: Id,
  workflowId: Id,
  version: z.number().int().positive(),
  agentId: Id,
  steps: z.array(WorkflowStepDef).min(1).max(12),
  changeNote: z.string().max(200),
  createdAt: IsoDateTime,
});
export type WorkflowVersion = z.infer<typeof WorkflowVersion>;

export const WorkflowSummary = z.object({
  id: Id,
  name: z.string(),
  recipe: z.enum(["policy_review", "csv_analysis", "presentation_prep", "custom"]),
  description: z.string(),
  currentVersion: z.number().int().positive(),
  agentId: Id,
  stepCount: z.number().int().positive(),
  lastRunStatus: z.string().nullable(),
  label: DataLabel,
  updatedAt: IsoDateTime,
});
export type WorkflowSummary = z.infer<typeof WorkflowSummary>;

export const WorkflowDetail = WorkflowSummary.extend({
  versions: z.array(WorkflowVersion),
  current: WorkflowVersion,
});
export type WorkflowDetail = z.infer<typeof WorkflowDetail>;

export const WorkflowRunStatus = z.enum(["preview", "running", "paused", "awaiting_confirmation", "succeeded", "failed", "cancelled"]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatus>;

export const WorkflowCheckpoint = z.object({
  stepKey: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed", "skipped", "awaiting_confirmation", "cancelled"]),
  attempt: z.number().int().nonnegative(),
  idempotencyKey: z.string(),
  outputSummary: z.string().nullable(),
  artifactId: Id.nullable(),
  runId: Id.nullable(),
  finishedAt: IsoDateTime.nullable(),
});
export type WorkflowCheckpoint = z.infer<typeof WorkflowCheckpoint>;

export const WorkflowRun = z.object({
  id: Id,
  workflowId: Id,
  workflowVersion: z.number().int().positive(),
  projectId: Id,
  status: WorkflowRunStatus,
  currentStepKey: z.string().nullable(),
  checkpoints: z.array(WorkflowCheckpoint),
  inputs: z.record(z.string(), z.string()),
  costNanoUsd: NanoUsd.nullable(),
  costStatus: z.enum(["no_provider_charge", "calculated", "unknown"]),
  startedAt: IsoDateTime,
  updatedAt: IsoDateTime,
  /** Display names for the run log ("who started / paused"); optional for older records. */
  startedByName: z.string().nullable().optional(),
  pausedByName: z.string().nullable().optional(),
  pausedAt: IsoDateTime.nullable().optional(),
});
export type WorkflowRun = z.infer<typeof WorkflowRun>;

export const StartWorkflowRequest = z.object({
  projectId: Id,
  version: z.number().int().positive(),
  inputs: z.record(z.string(), z.string().max(2000)),
  idempotencyKey: z.string().min(8).max(64),
});
