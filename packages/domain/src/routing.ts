import type { Capability, ModelRegistryEntry, RoutingDecision, RoutingPolicy, TaskKind } from "@atlas/contracts";

export interface RoutingInput {
  task: TaskKind;
  pinnedModelKey: string | null;
  agentModelKey: string | null;
  requiredCapabilities: Capability[];
  /** Approval the user gave explicitly for a pending fallback. */
  approvedFallbackKey?: string | null;
  /** Data classification forbids external providers (privacy policy). */
  externalBlocked?: boolean;
}

function usable(model: ModelRegistryEntry | undefined, caps: Capability[], externalBlocked: boolean): { ok: boolean; why: string | null } {
  if (!model) return { ok: false, why: "Model is not in the registry." };
  if (model.availability.mode === "pending") return { ok: false, why: model.availability.reason ?? "Provider not connected." };
  if (externalBlocked && model.provider !== "local") return { ok: false, why: "Privacy policy blocks sending this data to external providers." };
  const missing = caps.filter((c) => !model.capabilities.includes(c));
  if (missing.length) return { ok: false, why: `Model lacks required capability: ${missing.join(", ")}.` };
  return { ok: true, why: null };
}

const priceOf = (m: ModelRegistryEntry | undefined) => (m?.currentPrice?.base.outputPerMTok ? Number(m.currentPrice.base.outputPerMTok) : null);

/**
 * Deterministic routing. Precedence: user pin → agent default → policy rule →
 * workspace default. When the chosen model cannot run, Atlas proposes an
 * alternative that needs explicit approval; it never downgrades or switches
 * provider silently.
 */
export function route(input: RoutingInput, policy: RoutingPolicy, registry: ModelRegistryEntry[]): RoutingDecision {
  const byKey = (k: string | null | undefined) => (k ? registry.find((m) => m.key === k) : undefined);
  const rule = policy.rules.find((r) => r.task === input.task);
  const caps = [...new Set([...input.requiredCapabilities, ...(rule?.requiredCapabilities ?? [])])];
  const externalBlocked = input.externalBlocked ?? false;

  const candidates: Array<{ key: string | null; source: RoutingDecision["source"]; reason: string }> = [
    { key: input.pinnedModelKey, source: "pinned_by_user", reason: "Pinned by you for this conversation." },
    { key: input.agentModelKey, source: "agent_default", reason: "Default model of the selected agent version." },
    { key: rule?.preferredModelKey ?? null, source: "policy_rule", reason: `Routing policy v${policy.version} rule for ${input.task.replace(/_/g, " ")}.` },
    { key: policy.defaultModelKey, source: "workspace_default", reason: "Workspace default model." },
  ];
  const chosen = candidates.find((c) => c.key);
  if (!chosen?.key) {
    return { modelKey: policy.defaultModelKey, source: "workspace_default", reason: "No model configured.", pendingFallback: null, blocked: { code: "NO_MODEL", message: "No model configured." } };
  }
  const primary = byKey(chosen.key);
  const check = usable(primary, caps, externalBlocked);
  if (check.ok) return { modelKey: chosen.key, source: chosen.source, reason: chosen.reason, pendingFallback: null, blocked: null };

  // Pinned models are respected: no alternative is chosen for the user.
  const fallbackKey = chosen.source === "pinned_by_user" ? null : (rule?.fallbackModelKey ?? null);
  const fallback = byKey(fallbackKey);
  const fbCheck = usable(fallback, caps, externalBlocked);
  if (fallbackKey && fallback && fbCheck.ok) {
    const changesProvider = fallback.provider !== primary?.provider;
    const changesPrice = priceOf(fallback) !== priceOf(primary);
    if (input.approvedFallbackKey === fallbackKey) {
      return { modelKey: fallbackKey, source: chosen.source, reason: `Approved alternative: ${check.why}`, pendingFallback: null, blocked: null };
    }
    return {
      modelKey: chosen.key,
      source: chosen.source,
      reason: chosen.reason,
      pendingFallback: { modelKey: fallbackKey, reason: check.why ?? "Unavailable", changesProvider, changesPrice },
      blocked: { code: "FALLBACK_REQUIRES_APPROVAL", message: `${primary?.displayName ?? chosen.key} cannot run: ${check.why} Approve the alternative to continue.` },
    };
  }
  return {
    modelKey: chosen.key,
    source: chosen.source,
    reason: chosen.reason,
    pendingFallback: null,
    blocked: { code: "MODEL_UNAVAILABLE", message: `${primary?.displayName ?? chosen.key} cannot run: ${check.why}` },
  };
}

export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  id: "pol_routing_default",
  version: 1,
  defaultModelKey: "local:atlas-extractive-v1",
  allowAutomaticFallback: false,
  updatedAt: "2026-10-12T15:30:00.000Z",
  rules: [
    { id: "r_chat", task: "chat_answer", preferredModelKey: "anthropic:claude-sonnet-5-5", requiredCapabilities: ["text"], fallbackModelKey: "local:atlas-extractive-v1", maxEstimatedCostNanoUsd: "200000000" },
    { id: "r_compliance", task: "compliance_review", preferredModelKey: "anthropic:claude-opus-5-5", requiredCapabilities: ["text"], fallbackModelKey: "local:atlas-extractive-v1", maxEstimatedCostNanoUsd: "500000000" },
    { id: "r_data", task: "data_analysis", preferredModelKey: "local:atlas-extractive-v1", requiredCapabilities: ["deterministic_tools"], fallbackModelKey: null, maxEstimatedCostNanoUsd: null },
    { id: "r_deck", task: "presentation", preferredModelKey: "anthropic:claude-sonnet-5-5", requiredCapabilities: ["text"], fallbackModelKey: "local:atlas-extractive-v1", maxEstimatedCostNanoUsd: "300000000" },
    { id: "r_reco", task: "recommendation", preferredModelKey: "local:atlas-extractive-v1", requiredCapabilities: ["templates"], fallbackModelKey: null, maxEstimatedCostNanoUsd: null },
    { id: "r_embed", task: "embedding", preferredModelKey: "local:atlas-extractive-v1", requiredCapabilities: ["extractive_retrieval"], fallbackModelKey: null, maxEstimatedCostNanoUsd: null },
  ],
};
