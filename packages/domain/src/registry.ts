import type { ModelPriceVersion, ModelRegistryEntry } from "@atlas/contracts";

/**
 * Versioned model registry (registryVersion 1).
 *
 * Anthropic entries were checked on 2026-10-12 against:
 *  - https://platform.claude.com/docs/en/about-claude/models/overview  (IDs, context, max output, capabilities)
 *  - https://platform.claude.com/docs/en/about-claude/pricing          (base, cache write 5m/1h, cache read, output)
 *  - https://platform.claude.com/docs/en/build-with-claude/extended-thinking (thinking tokens are part of billed output;
 *    `usage.output_tokens_details.thinking_tokens` reports the subset)
 *
 * Gemini entries are intentionally absent: the official docs host (ai.google.dev)
 * was unreachable from the build environment, so no model ID or price is
 * asserted. The provider is listed as "pending" until verified.
 *
 * Availability defaults to "pending" for every external model. The API server
 * flips a model to "connected" only when credentials and an authorized budget
 * exist in its environment.
 */

export const REGISTRY_VERSION = 1;
const CHECKED_AT = "2026-10-12T15:30:00.000Z";
const EFFECTIVE_FROM = "2026-10-12T00:00:00.000Z";

const ANTHROPIC_SOURCES = [
  { label: "Anthropic models overview", url: "https://platform.claude.com/docs/en/about-claude/models/overview" },
  { label: "Anthropic pricing", url: "https://platform.claude.com/docs/en/about-claude/pricing" },
];

const anthropicSemantics = { thinkingIncludedInOutput: true, cacheReadIncludedInPromptTotal: false } as const;
const anthropicToolCharges = [{ tool: "web_search", unit: "per_1k_requests" as const, usd: "10" }];

function anthropicPrice(
  key: string,
  base: { input: string; output: string; w5m: string; w1h: string; read: string },
  tiers: ModelPriceVersion["tiers"] = [],
): ModelPriceVersion {
  return {
    id: `prc_${key.replace(/[^a-z0-9]/gi, "_")}_v1`,
    modelKey: key,
    version: 1,
    currency: "USD",
    base: {
      inputPerMTok: base.input,
      outputPerMTok: base.output,
      cacheWrite5mPerMTok: base.w5m,
      cacheWrite1hPerMTok: base.w1h,
      cacheReadPerMTok: base.read,
    },
    tiers,
    toolCharges: anthropicToolCharges,
    semantics: anthropicSemantics,
    effectiveFrom: EFFECTIVE_FROM,
    sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
    verifiedAt: CHECKED_AT,
    kind: "provider_charge",
  };
}

const pendingCredentials = {
  mode: "pending" as const,
  reason: "No server credentials or authorized budget configured for Anthropic in this environment.",
};

const CLAUDE_CAPS = ["text", "vision", "pdf_input", "tools", "adaptive_thinking", "prompt_caching"] as const;

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    key: "local:atlas-extractive-v1",
    provider: "local",
    modelId: "atlas-extractive-v1",
    displayName: "Atlas Local · extractive",
    family: "Local (no generative model)",
    capabilities: ["text", "extractive_retrieval", "deterministic_tools", "templates"],
    contextWindowTokens: null,
    maxOutputTokens: null,
    availability: { mode: "local", reason: null },
    currentPrice: {
      id: "prc_local_v1",
      modelKey: "local:atlas-extractive-v1",
      version: 1,
      currency: "USD",
      base: { inputPerMTok: "0", outputPerMTok: "0", cacheWrite5mPerMTok: "0", cacheWrite1hPerMTok: "0", cacheReadPerMTok: "0" },
      tiers: [],
      toolCharges: [],
      semantics: { thinkingIncludedInOutput: null, cacheReadIncludedInPromptTotal: null },
      effectiveFrom: EFFECTIVE_FROM,
      sourceUrl: null,
      verifiedAt: CHECKED_AT,
      kind: "no_provider_charge",
    },
    registryVersion: REGISTRY_VERSION,
    verification: {
      status: "verified",
      sources: [],
      checkedAt: CHECKED_AT,
      notes: "Runs inside Atlas: lexical retrieval, extractive answers, templates and deterministic calculations. Not a generative model; no vision/OCR.",
    },
  },
  {
    key: "anthropic:claude-opus-5-5",
    provider: "anthropic",
    modelId: "claude-opus-5-5",
    displayName: "Claude Opus 5.5",
    family: "Claude Opus",
    capabilities: [...CLAUDE_CAPS],
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    availability: pendingCredentials,
    currentPrice: anthropicPrice("anthropic:claude-opus-5-5", { input: "4", output: "20", w5m: "5", w1h: "8", read: "0.20" }),
    registryVersion: REGISTRY_VERSION,
    verification: { status: "verified", sources: ANTHROPIC_SOURCES, checkedAt: CHECKED_AT, notes: "Adaptive thinking always on; default effort medium." },
  },
  {
    key: "anthropic:claude-sonnet-5-5",
    provider: "anthropic",
    modelId: "claude-sonnet-5-5",
    displayName: "Claude Sonnet 5.5",
    family: "Claude Sonnet",
    capabilities: [...CLAUDE_CAPS],
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    availability: pendingCredentials,
    currentPrice: anthropicPrice("anthropic:claude-sonnet-5-5", { input: "2", output: "10", w5m: "2.50", w1h: "4", read: "0.10" }),
    registryVersion: REGISTRY_VERSION,
    verification: { status: "verified", sources: ANTHROPIC_SOURCES, checkedAt: CHECKED_AT, notes: "Adaptive thinking; default effort high." },
  },
  {
    key: "anthropic:claude-haiku-5-5",
    provider: "anthropic",
    modelId: "claude-haiku-5-5",
    displayName: "Claude Haiku 5.5",
    family: "Claude Haiku",
    capabilities: [...CLAUDE_CAPS],
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    availability: pendingCredentials,
    currentPrice: anthropicPrice(
      "anthropic:claude-haiku-5-5",
      { input: "0.10", output: "0.50", w5m: "0.125", w1h: "0.20", read: "0.01" },
      [
        {
          promptTokensAbove: 100_000,
          prices: { inputPerMTok: "0.50", outputPerMTok: "2.50", cacheWrite5mPerMTok: "0.625", cacheWrite1hPerMTok: "1", cacheReadPerMTok: "0.05" },
        },
      ],
    ),
    registryVersion: REGISTRY_VERSION,
    verification: {
      status: "verified",
      sources: ANTHROPIC_SOURCES,
      checkedAt: CHECKED_AT,
      notes: "Prompt-length pricing: prompts over 100,000 tokens (incl. cache read/write) use the higher tier.",
    },
  },
  {
    key: "anthropic:claude-fable-5-1",
    provider: "anthropic",
    modelId: "claude-fable-5-1",
    displayName: "Claude Fable 5.1",
    family: "Claude Fable",
    capabilities: [...CLAUDE_CAPS],
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 128_000,
    availability: pendingCredentials,
    currentPrice: anthropicPrice("anthropic:claude-fable-5-1", { input: "10", output: "50", w5m: "12.50", w1h: "20", read: "0.25" }),
    registryVersion: REGISTRY_VERSION,
    verification: {
      status: "verified",
      sources: ANTHROPIC_SOURCES,
      checkedAt: CHECKED_AT,
      notes: "Highest price tier; requires 30-day data retention per provider docs. Not a routing default.",
    },
  },
];

export const PENDING_PROVIDERS = [
  {
    provider: "google_gemini" as const,
    displayName: "Google Gemini",
    reason:
      "Adapter contract prepared; model IDs and prices not asserted because official docs (ai.google.dev) were unreachable from the build environment on 2026-10-12. Verify before enabling.",
  },
];

export function findModel(key: string): ModelRegistryEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.key === key);
}

export const LOCAL_MODEL_KEY = "local:atlas-extractive-v1";
