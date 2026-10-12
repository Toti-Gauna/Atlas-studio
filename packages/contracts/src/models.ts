import { z } from "zod";
import { Id, IntegrationMode, IsoDateTime } from "./common";

export const ProviderId = z.enum(["anthropic", "google_gemini", "local"]);
export type ProviderId = z.infer<typeof ProviderId>;

export const Capability = z.enum([
  "text",
  "vision",
  "pdf_input",
  "tools",
  "adaptive_thinking",
  "prompt_caching",
  "extractive_retrieval",
  "deterministic_tools",
  "templates",
]);
export type Capability = z.infer<typeof Capability>;

/**
 * Price categories per million tokens (USD, decimal string) for one price version.
 * Missing categories mean "unknown", never zero.
 */
export const TokenPriceTable = z.object({
  inputPerMTok: z.string().nullable(),
  outputPerMTok: z.string().nullable(),
  cacheWrite5mPerMTok: z.string().nullable(),
  cacheWrite1hPerMTok: z.string().nullable(),
  cacheReadPerMTok: z.string().nullable(),
});
export type TokenPriceTable = z.infer<typeof TokenPriceTable>;

export const PriceTier = z.object({
  /** Applies when the request's total prompt tokens (incl. cache read/write) exceed this value. */
  promptTokensAbove: z.number().int().nonnegative(),
  prices: TokenPriceTable,
});

export const ToolCharge = z.object({
  tool: z.string(),
  unit: z.enum(["per_1k_requests", "per_hour"]),
  usd: z.string(),
});

export const ModelPriceVersion = z.object({
  id: Id,
  modelKey: z.string(),
  version: z.number().int().positive(),
  currency: z.literal("USD"),
  base: TokenPriceTable,
  tiers: z.array(PriceTier),
  toolCharges: z.array(ToolCharge),
  /** Provider semantics that matter for normalization (documented per provider). */
  semantics: z.object({
    thinkingIncludedInOutput: z.boolean().nullable(),
    cacheReadIncludedInPromptTotal: z.boolean().nullable(),
  }),
  effectiveFrom: IsoDateTime,
  sourceUrl: z.string().url().nullable(),
  verifiedAt: IsoDateTime.nullable(),
  /** "provider_charge": priced by provider; "no_provider_charge": local adapter; "unverified": do not compute. */
  kind: z.enum(["provider_charge", "no_provider_charge", "unverified"]),
});
export type ModelPriceVersion = z.infer<typeof ModelPriceVersion>;

export const ModelAvailability = z.object({
  mode: IntegrationMode,
  /** Human-readable reason shown when a model is disabled. */
  reason: z.string().nullable(),
});

export const ModelRegistryEntry = z.object({
  /** Stable registry key, e.g. `anthropic:claude-opus-5-5`. */
  key: z.string(),
  provider: ProviderId,
  /** Exact API model ID as documented by the provider; null until verified. */
  modelId: z.string().nullable(),
  displayName: z.string(),
  family: z.string(),
  capabilities: z.array(Capability),
  contextWindowTokens: z.number().int().positive().nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
  availability: ModelAvailability,
  currentPrice: ModelPriceVersion.nullable(),
  registryVersion: z.number().int().positive(),
  verification: z.object({
    status: z.enum(["verified", "pending"]),
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })),
    checkedAt: IsoDateTime,
    notes: z.string().nullable(),
  }),
});
export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntry>;

export const ProviderStatus = z.object({
  provider: ProviderId,
  displayName: z.string(),
  mode: IntegrationMode,
  reason: z.string(),
  /** Never contains keys; only whether server env has them. */
  credentialsConfigured: z.boolean(),
  budgetAuthorized: z.boolean(),
  lastCheckedAt: IsoDateTime.nullable(),
});
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const TaskKind = z.enum([
  "chat_answer",
  "compliance_review",
  "data_analysis",
  "presentation",
  "drafting",
  "architecture",
  "recommendation",
  "embedding",
  "comparison",
  "workflow_step",
]);
export type TaskKind = z.infer<typeof TaskKind>;

export const RoutingRule = z.object({
  id: z.string(),
  task: TaskKind,
  preferredModelKey: z.string(),
  requiredCapabilities: z.array(Capability),
  /** Optional alternative; switching to it always requires explicit approval when provider or price changes. */
  fallbackModelKey: z.string().nullable(),
  maxEstimatedCostNanoUsd: z.string().nullable(),
});
export type RoutingRule = z.infer<typeof RoutingRule>;

export const RoutingPolicy = z.object({
  id: Id,
  version: z.number().int().positive(),
  rules: z.array(RoutingRule),
  defaultModelKey: z.string(),
  allowAutomaticFallback: z.literal(false),
  updatedAt: IsoDateTime,
});
export type RoutingPolicy = z.infer<typeof RoutingPolicy>;

export const RoutingDecision = z.object({
  modelKey: z.string(),
  source: z.enum(["pinned_by_user", "agent_default", "policy_rule", "workspace_default"]),
  reason: z.string(),
  /** If the preferred model cannot run, the alternative requires approval; nothing switches silently. */
  pendingFallback: z
    .object({
      modelKey: z.string(),
      reason: z.string(),
      changesProvider: z.boolean(),
      changesPrice: z.boolean(),
    })
    .nullable(),
  blocked: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type RoutingDecision = z.infer<typeof RoutingDecision>;
