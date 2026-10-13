import type { WorkflowRun, WorkflowSummary } from "@atlas/contracts";
import { formatDateTime } from "@/lib/format";
import { RECIPE_INPUTS } from "@/copy/workflows";

export const workflowHref = (id: string, extra?: Record<string, string | null | undefined>) => {
  const q = new URLSearchParams({ id });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
  return `/app/workflow/?${q.toString()}`;
};

/** Runs that cannot continue without a person. */
export const needsYou = (status: string) => status === "paused" || status === "awaiting_confirmation";

const DAY = 86_400_000;

/** "Today 14:02", "Yesterday 09:15" or "Oct 9, 14:02" — a run's name for people. */
export function runWhen(isoString: string, now = Date.now()): string {
  const time = formatDateTime(isoString, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const day = (t: number) => formatDateTime(new Date(t).toISOString(), { year: "numeric", month: "2-digit", day: "2-digit" });
  const d = day(Date.parse(isoString));
  if (d === day(now)) return `Today ${time}`;
  if (d === day(now - DAY)) return `Yesterday ${time}`;
  return `${formatDateTime(isoString, { month: "short", day: "numeric" })}, ${time}`;
}

/** Date + the run's main input (its objective), instead of an internal run id. */
export function runName(run: Pick<WorkflowRun, "startedAt" | "inputs" | "startedByName">, recipe?: WorkflowSummary["recipe"]): string {
  const keys = recipe ? RECIPE_INPUTS[recipe].map((r) => r.key) : [];
  const main = [...keys, ...Object.keys(run.inputs)].map((k) => run.inputs[k]).find((v) => v && v.trim());
  return [runWhen(run.startedAt), run.startedByName?.split(" ")[0], main].filter(Boolean).join(" · ");
}

/** One key per "run click session"; reused on retry so the server can deduplicate. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
