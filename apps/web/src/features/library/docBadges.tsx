"use client";
import type { Classification, IngestionStatus } from "@atlas/contracts";
import { Badge, StatusBadge, type Tone } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";

const CLASS_TONE: Record<Classification, Tone> = { public: "neutral", internal: "neutral", confidential: "warn", restricted: "danger" };
const isSensitiveClass = (c: Classification) => c === "confidential" || c === "restricted";

/** Classification as a badge (document header). */
export function ClassificationBadge({ value }: { value: Classification }) {
  return (
    <Badge tone={CLASS_TONE[value]} dot>
      {L.classification[value]}
    </Badge>
  );
}

/** In lists, only confidential/restricted earn a badge; public and internal read as plain text. */
export function ClassificationText({ value }: { value: Classification }) {
  return isSensitiveClass(value) ? <ClassificationBadge value={value} /> : <>{L.classification[value]}</>;
}

/** Ingestion status is shown only when it is the exception (not Ready). In-flight states are static labels — no fake progress. */
export function DocStatus({ status }: { status: IngestionStatus }) {
  return status === "ready" ? null : <StatusBadge kind="document" status={status} />;
}
