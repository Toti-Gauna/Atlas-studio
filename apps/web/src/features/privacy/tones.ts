import type { RedactionReview } from "@atlas/contracts";
import type { Tone } from "@/components/ui";

export const SEVERITY_TONE: Record<string, Tone> = { low: "neutral", medium: "warn", high: "danger" };
export const STATUS_TONE: Record<RedactionReview["status"], Tone> = { pending_review: "warn", redacted: "teal", approved_original: "info", rejected: "neutral" };
