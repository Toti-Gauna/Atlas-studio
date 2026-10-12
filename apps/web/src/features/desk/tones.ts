import type { Ticket } from "@atlas/contracts";
import type { Tone } from "@/components/ui";

export const STATUS_TONE: Record<Ticket["status"], Tone> = { open: "info", pending_customer: "warn", resolved: "teal", closed: "neutral" };
export const PRIORITY_TONE: Record<Ticket["priority"], Tone> = { low: "neutral", normal: "neutral", high: "danger" };
