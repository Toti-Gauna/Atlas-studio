"use client";
import type { ReactNode } from "react";
import { Badge, type Tone } from "./controls";
import s from "./surfaces.module.css";

/**
 * One dictionary for every status the UI shows, so the same state always has
 * the same words and color everywhere (runs, steps, tickets, reviews, privacy,
 * documents, memory, ledger).
 */
type Entry = readonly [label: string, tone: Tone];
const STATUS = {
  run: {
    planned: ["Planned", "neutral"],
    preview: ["Preview", "neutral"],
    pending: ["Pending", "neutral"],
    queued: ["Queued", "neutral"],
    running: ["Running", "info"],
    in_flight: ["Running", "info"],
    paused: ["Paused", "warn"],
    awaiting_confirmation: ["Needs your confirmation", "warn"],
    succeeded: ["Succeeded", "teal"],
    completed: ["Completed", "teal"],
    abstained: ["No answer — needs a person", "info"],
    failed: ["Failed", "danger"],
    cancelled: ["Cancelled", "neutral"],
    blocked: ["Blocked", "warn"],
    skipped: ["Skipped", "neutral"],
    denied: ["Not allowed", "warn"],
    reserved: ["Reserved", "neutral"],
    released: ["Released", "neutral"],
  },
  ticket: {
    open: ["Open", "info"],
    pending_customer: ["Waiting on customer", "warn"],
    resolved: ["Resolved", "teal"],
    closed: ["Closed", "neutral"],
  },
  review: {
    open: ["Waiting for review", "info"],
    approved: ["Approved", "teal"],
    changes_requested: ["Changes requested", "warn"],
    superseded: ["Superseded", "neutral"],
  },
  privacy: {
    pending_review: ["Needs a decision", "warn"],
    redacted: ["Redacted", "teal"],
    approved_original: ["Original approved", "info"],
    rejected: ["Rejected", "neutral"],
  },
  document: {
    queued: ["Queued", "neutral"],
    parsing: ["Reading", "info"],
    indexing: ["Indexing", "info"],
    ready: ["Ready", "teal"],
    failed: ["Couldn’t read", "danger"],
  },
  memory: {
    proposed: ["Suggested", "info"],
    approved: ["In use", "teal"],
    disabled: ["Off", "neutral"],
  },
  service: {
    received: ["Received", "info"],
    in_progress: ["In progress", "warn"],
    done: ["Done", "teal"],
  },
} satisfies Record<string, Record<string, Entry>>;

export type StatusKind = keyof typeof STATUS;

const humanize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ");

export function statusLabel(kind: StatusKind, status: string): string {
  return (STATUS[kind] as Record<string, Entry>)[status]?.[0] ?? humanize(status);
}

export function statusTone(kind: StatusKind, status: string): Tone {
  return (STATUS[kind] as Record<string, Entry>)[status]?.[1] ?? "neutral";
}

export function StatusBadge({ kind, status }: { kind: StatusKind; status: string }) {
  return (
    <Badge tone={statusTone(kind, status)} dot>
      {statusLabel(kind, status)}
    </Badge>
  );
}

/**
 * Engineering detail (IDs, hashes, scores, idempotency keys, token counts) lives
 * behind this disclosure — available for audit, out of the way for the task.
 */
export function TechDetails({ children, summary = "Technical details" }: { children: ReactNode; summary?: string }) {
  return (
    <details className={s.tech}>
      <summary className={s.techSummary}>{summary}</summary>
      <div className={s.techBody}>{children}</div>
    </details>
  );
}
