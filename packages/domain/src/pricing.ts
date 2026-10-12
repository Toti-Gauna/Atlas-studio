import type { CostStatus, ModelPriceVersion, NormalizedUsage, TokenPriceTable } from "@atlas/contracts";
import { perThousandCostNanoUsd, tokenCostNanoUsd } from "./money";

/* ------------------------------------------------------------------ */
/* Provider usage normalization                                        */
/* ------------------------------------------------------------------ */

/** Shape of `usage` on an Anthropic Messages API response (fields may be absent). */
export interface AnthropicUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
  output_tokens_details?: { thinking_tokens?: number | null } | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null; code_execution_requests?: number | null } | null;
}

export interface NormalizationResult {
  usage: NormalizedUsage;
  /** Assumptions made while normalizing; any assumption downgrades cost to "estimated". */
  assumptions: string[];
}

const n = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null);

/**
 * Anthropic semantics (pricing + prompt caching docs):
 *  - `input_tokens` is the uncached remainder; total prompt = input + cache_creation + cache_read.
 *  - `output_tokens` already includes thinking; `output_tokens_details.thinking_tokens` is the subset.
 *  - `cache_creation` splits writes by TTL (5m at 1.25x, 1h at 2x).
 */
export function normalizeAnthropicUsage(raw: AnthropicUsage | null | undefined): NormalizationResult {
  const assumptions: string[] = [];
  if (!raw) {
    return {
      usage: {
        inputUncachedTokens: null,
        cacheWrite5mTokens: null,
        cacheWrite1hTokens: null,
        cacheReadTokens: null,
        outputTokens: null,
        thinkingTokensReported: null,
        thinkingIncludedInOutput: true,
        toolRequests: {},
        promptTokensForTier: null,
      },
      assumptions: ["usage not reported"],
    };
  }
  const input = n(raw.input_tokens);
  const cacheRead = n(raw.cache_read_input_tokens) ?? 0;
  const writeTotal = n(raw.cache_creation_input_tokens) ?? 0;
  let w5m = n(raw.cache_creation?.ephemeral_5m_input_tokens);
  let w1h = n(raw.cache_creation?.ephemeral_1h_input_tokens);
  if (w5m === null && w1h === null) {
    w5m = writeTotal;
    w1h = 0;
    if (writeTotal > 0) assumptions.push("cache write TTL breakdown not reported; priced at the 5-minute write rate");
  } else {
    w5m = w5m ?? 0;
    w1h = w1h ?? 0;
  }
  const toolRequests: Record<string, number> = {};
  const web = n(raw.server_tool_use?.web_search_requests);
  if (web) toolRequests.web_search = web;
  const fetch = n(raw.server_tool_use?.web_fetch_requests);
  if (fetch) toolRequests.web_fetch = fetch;
  const code = n(raw.server_tool_use?.code_execution_requests);
  if (code) toolRequests.code_execution = code;

  return {
    usage: {
      inputUncachedTokens: input,
      cacheWrite5mTokens: w5m,
      cacheWrite1hTokens: w1h,
      cacheReadTokens: cacheRead,
      outputTokens: n(raw.output_tokens),
      thinkingTokensReported: n(raw.output_tokens_details?.thinking_tokens),
      thinkingIncludedInOutput: true,
      toolRequests,
      promptTokensForTier: input === null ? null : input + cacheRead + w5m + w1h,
    },
    assumptions,
  };
}

/**
 * Gemini `usageMetadata` shape. PENDING VERIFICATION against official docs
 * (ai.google.dev unreachable from the build environment). Semantics encoded:
 * `promptTokenCount` includes `cachedContentTokenCount`; `thoughtsTokenCount`
 * is reported separately from `candidatesTokenCount` and billed as output.
 * The registry holds no Gemini price, so cost stays "unknown" until verified.
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number | null;
  cachedContentTokenCount?: number | null;
  candidatesTokenCount?: number | null;
  thoughtsTokenCount?: number | null;
  toolUsePromptTokenCount?: number | null;
  totalTokenCount?: number | null;
}

export function normalizeGeminiUsage(raw: GeminiUsageMetadata | null | undefined): NormalizationResult {
  const assumptions = ["Gemini usage semantics pending verification against official documentation"];
  const prompt = n(raw?.promptTokenCount);
  const cached = n(raw?.cachedContentTokenCount) ?? 0;
  const toolPrompt = n(raw?.toolUsePromptTokenCount) ?? 0;
  const candidates = n(raw?.candidatesTokenCount);
  const thoughts = n(raw?.thoughtsTokenCount);
  return {
    usage: {
      inputUncachedTokens: prompt === null ? null : Math.max(0, prompt - cached) + toolPrompt,
      cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 0,
      cacheReadTokens: cached,
      // Thoughts are not inside candidates for Gemini, so the billable output is their sum (counted once).
      outputTokens: candidates === null ? null : candidates + (thoughts ?? 0),
      thinkingTokensReported: thoughts,
      thinkingIncludedInOutput: true,
      toolRequests: {},
      promptTokensForTier: prompt === null ? null : prompt + toolPrompt,
    },
    assumptions,
  };
}

/* ------------------------------------------------------------------ */
/* Cost calculation                                                    */
/* ------------------------------------------------------------------ */

export interface CostLine {
  category: "input" | "cache_write_5m" | "cache_write_1h" | "cache_read" | "output" | "tool";
  quantity: number;
  unitPriceUsdPerMTok: string | null;
  nanoUsd: string | null;
  note: string | null;
}

export interface CostResult {
  status: CostStatus;
  /** null when unknown. "0" only for local (no provider charge). */
  nanoUsd: string | null;
  lines: CostLine[];
  missing: string[];
  assumptions: string[];
  tierApplied: number | null;
}

function selectPrices(price: ModelPriceVersion, promptTokens: number | null): { table: TokenPriceTable; tier: number | null } | null {
  if (price.tiers.length === 0) return { table: price.base, tier: null };
  if (promptTokens === null) return null;
  const applicable = [...price.tiers].sort((a, b) => b.promptTokensAbove - a.promptTokensAbove).find((t) => promptTokens > t.promptTokensAbove);
  return applicable ? { table: applicable.prices, tier: applicable.promptTokensAbove } : { table: price.base, tier: null };
}

/**
 * Cost = Σ billable quantity × snapshot price + known tool charges.
 * Each normalized category is billed once; thinking is never added on top of
 * output and cache reads are never re-added to input. Missing usage or a
 * missing rate for a non-zero quantity makes the result "unknown", never zero.
 */
export function computeCost(usage: NormalizedUsage, price: ModelPriceVersion | null, assumptions: string[] = []): CostResult {
  if (price?.kind === "no_provider_charge") {
    return { status: "no_provider_charge", nanoUsd: "0", lines: [], missing: [], assumptions, tierApplied: null };
  }
  if (!price || price.kind === "unverified") {
    return { status: "unknown", nanoUsd: null, lines: [], missing: ["price version not verified"], assumptions, tierApplied: null };
  }
  const missing: string[] = [];
  const selected = selectPrices(price, usage.promptTokensForTier);
  if (!selected) {
    return { status: "unknown", nanoUsd: null, lines: [], missing: ["prompt length unknown for tiered pricing"], assumptions, tierApplied: null };
  }
  const { table, tier } = selected;
  const categories: Array<[CostLine["category"], number | null, string | null]> = [
    ["input", usage.inputUncachedTokens, table.inputPerMTok],
    ["cache_write_5m", usage.cacheWrite5mTokens, table.cacheWrite5mPerMTok],
    ["cache_write_1h", usage.cacheWrite1hTokens, table.cacheWrite1hPerMTok],
    ["cache_read", usage.cacheReadTokens, table.cacheReadPerMTok],
    ["output", usage.outputTokens, table.outputPerMTok],
  ];
  const lines: CostLine[] = [];
  let total = 0n;
  for (const [category, qty, rate] of categories) {
    if (qty === null) {
      missing.push(`${category} usage not reported`);
      lines.push({ category, quantity: 0, unitPriceUsdPerMTok: rate, nanoUsd: null, note: "not reported" });
      continue;
    }
    if (qty === 0) continue;
    if (rate === null) {
      missing.push(`${category} rate missing`);
      lines.push({ category, quantity: qty, unitPriceUsdPerMTok: null, nanoUsd: null, note: "rate missing" });
      continue;
    }
    const cost = tokenCostNanoUsd(qty, rate);
    total += cost;
    const note = category === "output" && usage.thinkingTokensReported ? `includes ${usage.thinkingTokensReported} reported thinking tokens` : null;
    lines.push({ category, quantity: qty, unitPriceUsdPerMTok: rate, nanoUsd: cost.toString(), note });
  }
  for (const [tool, count] of Object.entries(usage.toolRequests)) {
    if (!count) continue;
    const charge = price.toolCharges.find((c) => c.tool === tool);
    if (!charge) {
      missing.push(`no known charge for tool ${tool}`);
      lines.push({ category: "tool", quantity: count, unitPriceUsdPerMTok: null, nanoUsd: null, note: `${tool}: charge unknown` });
      continue;
    }
    if (charge.unit !== "per_1k_requests") {
      missing.push(`tool ${tool} billed by ${charge.unit}`);
      continue;
    }
    const cost = perThousandCostNanoUsd(count, charge.usd);
    total += cost;
    lines.push({ category: "tool", quantity: count, unitPriceUsdPerMTok: null, nanoUsd: cost.toString(), note: `${tool} at $${charge.usd} / 1k` });
  }
  if (missing.length > 0) {
    return { status: "unknown", nanoUsd: null, lines, missing, assumptions, tierApplied: tier };
  }
  return { status: assumptions.length > 0 ? "estimated" : "calculated", nanoUsd: total.toString(), lines, missing, assumptions, tierApplied: tier };
}

/**
 * Worst-case reservation for one call: all input priced at the higher of base
 * input and 5m cache write (Atlas never uses 1h writes), all output at the
 * output rate, using the highest tier when the prompt could exceed a threshold.
 */
export function reservationUpperBound(price: ModelPriceVersion | null, maxInputTokens: number, maxOutputTokens: number): bigint | null {
  if (!price) return null;
  if (price.kind === "no_provider_charge") return 0n;
  if (price.kind === "unverified") return null;
  const tables = [price.base, ...price.tiers.filter((t) => maxInputTokens > t.promptTokensAbove).map((t) => t.prices)];
  let worst = 0n;
  for (const t of tables) {
    if (!t.inputPerMTok || !t.outputPerMTok) return null;
    const inputRate = t.cacheWrite5mPerMTok && Number(t.cacheWrite5mPerMTok) > Number(t.inputPerMTok) ? t.cacheWrite5mPerMTok : t.inputPerMTok;
    const cost = tokenCostNanoUsd(maxInputTokens, inputRate) + tokenCostNanoUsd(maxOutputTokens, t.outputPerMTok);
    if (cost > worst) worst = cost;
  }
  return worst;
}

/** Deduplicate ledger writes only for the same provider usage event. */
export function ledgerDedupeKey(provider: string, providerRequestId: string | null, attemptId: string): string {
  return providerRequestId ? `${provider}:${providerRequestId}` : `attempt:${attemptId}`;
}

export interface BudgetState {
  limitNanoUsd: bigint;
  spentNanoUsd: bigint;
  reservedNanoUsd: bigint;
  hardStop: boolean;
}

/**
 * Pure admission check mirrored by the atomic SQL update in the API:
 * `UPDATE budgets SET reserved = reserved + $amt WHERE id = $id AND spent + reserved + $amt <= limit`.
 */
export function canReserve(budget: BudgetState, amount: bigint): { ok: true } | { ok: false; reason: string } {
  if (amount < 0n) return { ok: false, reason: "negative reservation" };
  const after = budget.spentNanoUsd + budget.reservedNanoUsd + amount;
  if (budget.hardStop && after > budget.limitNanoUsd) return { ok: false, reason: "budget would be exceeded" };
  return { ok: true };
}
