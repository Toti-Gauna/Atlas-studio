import type { Tone } from "@/components/ui";

/** Finding severity (not a status): only medium/high stand out. Review statuses use StatusBadge. */
export const SEVERITY_TONE: Record<string, Tone> = { low: "neutral", medium: "warn", high: "danger" };
