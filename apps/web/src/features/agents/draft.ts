import type { AgentConfig } from "@atlas/contracts";

/** Editable form state. Cost is edited in USD and converted to nano-USD only on save. */
export interface AgentDraft {
  name: string;
  config: AgentConfig;
  costUsd: string;
  changeNote: string;
}

export type DraftErrors = Partial<Record<"name" | "instructions" | "costUsd" | "maxSteps" | "maxSeconds" | "maxInputTokens" | "maxOutputTokens" | "briefQuestions", string>>;

export const LOCAL_MODEL = "local:atlas-extractive-v1";

export const DEFAULT_CONFIG: AgentConfig = {
  description: "",
  instructions: "",
  objective: "",
  outputFormat: "answer_with_citations",
  style: "direct",
  depth: "standard",
  clarifyPolicy: "when_missing_required",
  briefQuestions: [],
  sourceScope: { mode: "project_documents", documentIds: [] },
  modelKey: LOCAL_MODEL,
  temperature: null,
  allowedTools: ["retrieve_sources"],
  limits: { maxSteps: 6, maxSeconds: 90, maxInputTokens: 60_000, maxOutputTokens: 4_000, maxCostNanoUsd: "500000000" },
};

export const nanoToUsd = (nano: string) => {
  const n = Number(nano) / 1e9;
  return String(Number(n.toFixed(6)));
};

export const usdToNano = (usd: string) => String(Math.round(Number(usd) * 1e9));

export function makeDraft(name: string, config: AgentConfig): AgentDraft {
  return { name, config: structuredClone(config), costUsd: nanoToUsd(config.limits.maxCostNanoUsd), changeNote: "" };
}

const RANGES = {
  maxSteps: [1, 20],
  maxSeconds: [5, 600],
  maxInputTokens: [1000, 1_000_000],
  maxOutputTokens: [256, 128_000],
} as const;

export const LIMIT_RANGES = RANGES;

/** Mirrors the contract schema so problems surface before the request; the server re-validates. */
export function validate(d: AgentDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = "Name is required.";
  else if (d.name.trim().length > 60) e.name = "Use 60 characters or fewer.";
  if (!d.config.instructions.trim()) e.instructions = "Instructions are required.";
  for (const k of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
    const [min, max] = RANGES[k];
    const v = d.config.limits[k];
    if (!Number.isInteger(v) || v < min || v > max) e[k] = `Whole number between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`;
  }
  const usd = Number(d.costUsd);
  if (d.costUsd.trim() === "" || !Number.isFinite(usd) || usd < 0) e.costUsd = "Enter a cost of 0 or more.";
  if (d.config.briefQuestions.some((q) => q.length > 200)) e.briefQuestions = "Each question must be 200 characters or fewer.";
  return e;
}

export function toConfig(d: AgentDraft): AgentConfig {
  return {
    ...d.config,
    briefQuestions: d.config.briefQuestions.map((q) => q.trim()).filter(Boolean),
    limits: { ...d.config.limits, maxCostNanoUsd: usdToNano(d.costUsd) },
  };
}

/** Flattens a config into display strings per field for the version diff. */
export function flattenConfig(cfg: AgentConfig, docTitle: (id: string) => string, modelLabel: (k: string) => string): Record<string, string> {
  return {
    description: cfg.description || "—",
    instructions: cfg.instructions,
    objective: cfg.objective || "—",
    outputFormat: cfg.outputFormat,
    style: cfg.style,
    depth: cfg.depth,
    clarifyPolicy: cfg.clarifyPolicy,
    briefQuestions: cfg.briefQuestions.join("\n") || "—",
    "sourceScope.mode": cfg.sourceScope.mode,
    "sourceScope.documentIds": cfg.sourceScope.documentIds.map(docTitle).join(", ") || "—",
    modelKey: modelLabel(cfg.modelKey),
    temperature: cfg.temperature === null ? "Model default" : String(cfg.temperature),
    allowedTools: [...cfg.allowedTools].sort().join(", ") || "—",
    "limits.maxSteps": String(cfg.limits.maxSteps),
    "limits.maxSeconds": String(cfg.limits.maxSeconds),
    "limits.maxInputTokens": cfg.limits.maxInputTokens.toLocaleString("en-US"),
    "limits.maxOutputTokens": cfg.limits.maxOutputTokens.toLocaleString("en-US"),
    "limits.maxCostNanoUsd": `$${nanoToUsd(cfg.limits.maxCostNanoUsd)}`,
  };
}
