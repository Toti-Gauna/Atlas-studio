import { z } from "zod";
import { DataLabel, Id, IsoDateTime } from "./common";

/**
 * Fixed server-side tool allowlist. Agents can only reference these IDs and the
 * server re-checks every call against the agent version's policy; instructions
 * in prompts or documents cannot add tools.
 */
export const ToolId = z.enum([
  "retrieve_sources",
  "checklist_compare",
  "csv_profile",
  "csv_stats",
  "csv_aggregate",
  "chart_spec",
  "outline_presentation",
  "draft_artifact",
  "render_export",
  "redact_preview",
  "propose_service_request",
  "handoff_to_human",
  "propose_memory",
]);
export type ToolId = z.infer<typeof ToolId>;

export const ToolEffect = z.enum(["read", "compute", "internal_write", "requires_confirmation"]);

export const ToolDescriptor = z.object({
  id: ToolId,
  name: z.string(),
  description: z.string(),
  effect: ToolEffect,
  /** True when the tool is executed deterministically by Atlas (no model call). */
  deterministic: z.boolean(),
});
export type ToolDescriptor = z.infer<typeof ToolDescriptor>;

export const AgentStyle = z.enum(["direct", "analytical", "creative", "didactic"]);
export type AgentStyle = z.infer<typeof AgentStyle>;

export const AgentDepth = z.enum(["brief", "standard", "thorough"]);
export const ClarifyPolicy = z.enum(["never", "when_missing_required", "always_confirm_brief"]);
export const OutputFormat = z.enum(["answer_with_citations", "gap_report", "presentation", "data_report", "draft_document", "architecture_doc"]);

export const AgentLimits = z.object({
  maxSteps: z.number().int().min(1).max(20),
  maxSeconds: z.number().int().min(5).max(600),
  maxInputTokens: z.number().int().min(1000).max(1_000_000),
  maxOutputTokens: z.number().int().min(256).max(128_000),
  /** Per-run cost ceiling in nano-USD. */
  maxCostNanoUsd: z.string().regex(/^\d+$/),
});
export type AgentLimits = z.infer<typeof AgentLimits>;

export const AgentConfig = z.object({
  description: z.string().max(400),
  instructions: z.string().min(1).max(8000),
  objective: z.string().max(400),
  outputFormat: OutputFormat,
  style: AgentStyle,
  depth: AgentDepth,
  clarifyPolicy: ClarifyPolicy,
  /** Questions the agent asks before starting when clarifyPolicy requires it. */
  briefQuestions: z.array(z.string().max(200)).max(6),
  /** Authorized sources: subset of project documents. Empty = all project documents the actor can read. */
  sourceScope: z.object({
    mode: z.enum(["project_documents", "selected_documents"]),
    documentIds: z.array(Id),
  }),
  modelKey: z.string(),
  temperature: z.number().min(0).max(1).nullable(),
  allowedTools: z.array(ToolId),
  limits: AgentLimits,
});
export type AgentConfig = z.infer<typeof AgentConfig>;

export const AgentVersion = z.object({
  id: Id,
  agentId: Id,
  version: z.number().int().positive(),
  config: AgentConfig,
  changeNote: z.string().max(200),
  createdBy: Id,
  createdAt: IsoDateTime,
});
export type AgentVersion = z.infer<typeof AgentVersion>;

export const AgentSummary = z.object({
  id: Id,
  slug: z.string(),
  name: z.string().min(1).max(60),
  profile: z.enum(["compliance", "presentation", "data", "sales", "architecture", "research", "custom"]),
  builtIn: z.boolean(),
  description: z.string(),
  currentVersion: z.number().int().positive(),
  style: AgentStyle,
  modelKey: z.string(),
  allowedTools: z.array(ToolId),
  label: DataLabel,
  updatedAt: IsoDateTime,
});
export type AgentSummary = z.infer<typeof AgentSummary>;

export const AgentDetail = AgentSummary.extend({
  versions: z.array(AgentVersion),
  current: AgentVersion,
  guardrails: z.array(z.string()),
});
export type AgentDetail = z.infer<typeof AgentDetail>;

export const CreateAgentRequest = z.object({
  name: z.string().min(1).max(60),
  config: AgentConfig,
});

export const UpdateAgentRequest = z.object({
  /** Optimistic concurrency: the version being edited. */
  baseVersion: z.number().int().positive(),
  name: z.string().min(1).max(60).optional(),
  config: AgentConfig,
  changeNote: z.string().max(200),
});
