import { z } from "zod";
import { DataLabel, Id, IsoDateTime, NanoUsd } from "./common";
import { ProviderId } from "./models";

/**
 * Normalized usage. Each category is billed exactly once:
 * - inputUncachedTokens excludes cache reads/writes (Anthropic `input_tokens` semantics)
 * - outputTokens already INCLUDES thinking when the provider bills it as output;
 *   `thinkingTokensReported` is informational and never re-added.
 * Null means "not reported", which makes the cost unknown rather than zero.
 */
export const NormalizedUsage = z.object({
  inputUncachedTokens: z.number().int().nonnegative().nullable(),
  cacheWrite5mTokens: z.number().int().nonnegative().nullable(),
  cacheWrite1hTokens: z.number().int().nonnegative().nullable(),
  cacheReadTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  thinkingTokensReported: z.number().int().nonnegative().nullable(),
  thinkingIncludedInOutput: z.boolean().nullable(),
  toolRequests: z.record(z.string(), z.number().int().nonnegative()),
  /** Total prompt tokens used for tier selection (uncached + cache read + cache write). */
  promptTokensForTier: z.number().int().nonnegative().nullable(),
});
export type NormalizedUsage = z.infer<typeof NormalizedUsage>;

export const CostStatus = z.enum(["no_provider_charge", "calculated", "estimated", "unknown", "reconciled"]);
export type CostStatus = z.infer<typeof CostStatus>;

export const CostBreakdownLine = z.object({
  category: z.enum(["input", "cache_write_5m", "cache_write_1h", "cache_read", "output", "tool"]),
  quantity: z.number().int().nonnegative(),
  unitPriceUsdPerMTok: z.string().nullable(),
  nanoUsd: NanoUsd.nullable(),
  note: z.string().nullable(),
});

export const LedgerEntry = z.object({
  id: Id,
  runId: Id,
  attemptId: Id,
  attemptNumber: z.number().int().positive(),
  providerRequestId: z.string().nullable(),
  provider: ProviderId,
  modelKey: z.string(),
  modelId: z.string().nullable(),
  requestType: z.enum(["chat", "embedding", "recommendation", "comparison", "workflow_step", "evaluation"]),
  agentId: Id.nullable(),
  projectId: Id,
  userId: Id,
  status: z.enum(["succeeded", "failed", "cancelled"]),
  usage: NormalizedUsage,
  priceVersionId: Id.nullable(),
  costStatus: CostStatus,
  costNanoUsd: NanoUsd.nullable(),
  breakdown: z.array(CostBreakdownLine),
  latencyMs: z.number().int().nonnegative().nullable(),
  label: DataLabel,
  occurredAt: IsoDateTime,
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;

export const Budget = z.object({
  id: Id,
  scope: z.enum(["workspace", "project", "user", "agent"]),
  scopeId: Id,
  scopeLabel: z.string(),
  period: z.enum(["monthly", "daily"]),
  limitNanoUsd: NanoUsd,
  spentNanoUsd: NanoUsd,
  reservedNanoUsd: NanoUsd,
  /** Spend with unknown cost cannot be counted; surfaced separately. */
  unknownCostEntries: z.number().int().nonnegative(),
  alertThresholdPct: z.number().int().min(1).max(100),
  hardStop: z.boolean(),
  updatedAt: IsoDateTime,
});
export type Budget = z.infer<typeof Budget>;

export const BudgetReservation = z.object({
  id: Id,
  budgetIds: z.array(Id),
  runId: Id,
  attemptId: Id,
  amountNanoUsd: NanoUsd,
  status: z.enum(["held", "settled", "released", "expired"]),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime,
});
export type BudgetReservation = z.infer<typeof BudgetReservation>;

export const UsageGroupBy = z.enum(["model", "agent", "project", "user", "provider", "day"]);
export type UsageGroupBy = z.infer<typeof UsageGroupBy>;

export const UsageQuery = z.object({
  range: z.enum(["7d", "30d"]),
  groupBy: UsageGroupBy,
  provider: ProviderId.optional(),
  modelKey: z.string().optional(),
  agentId: Id.optional(),
  projectId: Id.optional(),
  userId: Id.optional(),
});
export type UsageQuery = z.infer<typeof UsageQuery>;

export const UsageGroup = z.object({
  key: z.string(),
  label: z.string(),
  runs: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  failedOrCancelled: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  thinkingTokensReported: z.number().int().nonnegative(),
  calculatedNanoUsd: NanoUsd,
  unknownCostEntries: z.number().int().nonnegative(),
  localEntries: z.number().int().nonnegative(),
  p50LatencyMs: z.number().int().nonnegative().nullable(),
});
export type UsageGroup = z.infer<typeof UsageGroup>;

export const UsageReport = z.object({
  query: UsageQuery,
  from: IsoDateTime,
  to: IsoDateTime,
  groups: z.array(UsageGroup),
  totals: UsageGroup.omit({ key: true, label: true }),
  daily: z.array(z.object({ day: z.string(), calculatedNanoUsd: NanoUsd, unknownCostEntries: z.number().int(), localEntries: z.number().int() })),
  label: DataLabel,
  disclaimer: z.string(),
});
export type UsageReport = z.infer<typeof UsageReport>;
