import type { WorkflowRunStatus } from "@atlas/contracts";
import type { Tone } from "@/components/ui";
import { RUN_STATUS_LABEL } from "@/copy/workflows";

export const WF_RUN_TONE: Record<WorkflowRunStatus, Tone> = {
  preview: "neutral",
  running: "info",
  paused: "warn",
  awaiting_confirmation: "warn",
  succeeded: "teal",
  failed: "danger",
  cancelled: "neutral",
};

/** Tolerates unknown strings from summaries (lastRunStatus is a plain string). */
export function runStatusLabel(status: string): string {
  return (RUN_STATUS_LABEL as Record<string, string>)[status] ?? status.replace(/_/g, " ");
}
export function runStatusTone(status: string): Tone {
  return (WF_RUN_TONE as Record<string, Tone>)[status] ?? "neutral";
}

export const workflowHref = (id: string, extra?: Record<string, string | null | undefined>) => {
  const q = new URLSearchParams({ id });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
  return `/app/workflow/?${q.toString()}`;
};

/** One key per "run click session"; reused on retry so the server can deduplicate. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
