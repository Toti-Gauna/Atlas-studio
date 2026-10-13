import type { Ticket } from "@atlas/contracts";

/** Priority is shown only when it is the exception (high). Ticket statuses use StatusBadge. */
export const isHighPriority = (p: Ticket["priority"]) => p === "high";
