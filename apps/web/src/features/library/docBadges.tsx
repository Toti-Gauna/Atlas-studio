"use client";
import { AlertTriangle, CheckCircle2, Clock, Loader } from "lucide-react";
import type { Classification, IngestionStatus } from "@atlas/contracts";
import { Badge, type Tone } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";

const STATUS_TONE: Record<IngestionStatus, Tone> = { queued: "neutral", parsing: "info", indexing: "info", ready: "teal", failed: "danger" };
const CLASS_TONE: Record<Classification, Tone> = { public: "neutral", internal: "info", confidential: "warn", restricted: "danger" };

/** Ingestion status. In-flight states are static labels — no fake progress. */
export function StatusBadge({ status, reason }: { status: IngestionStatus; reason?: string | null }) {
  const icon =
    status === "ready" ? <CheckCircle2 size={12} aria-hidden /> : status === "failed" ? <AlertTriangle size={12} aria-hidden /> : status === "queued" ? <Clock size={12} aria-hidden /> : <Loader size={12} aria-hidden />;
  return (
    <Badge tone={STATUS_TONE[status]} icon={icon} title={reason ?? undefined}>
      {L.status[status]}
    </Badge>
  );
}

export function ClassificationBadge({ value }: { value: Classification }) {
  return (
    <Badge tone={CLASS_TONE[value]} dot>
      {L.classification[value]}
    </Badge>
  );
}
