import type { ReviewRequest } from "@atlas/contracts";
import { reviewsCopy } from "@/copy/reviews";

export const REQUEST_TONE: Record<ReviewRequest["status"], "info" | "teal" | "warn" | "neutral"> = {
  open: "info",
  approved: "teal",
  changes_requested: "warn",
  superseded: "neutral",
};

export const requestLabel = (status: ReviewRequest["status"]) => reviewsCopy.status[status] ?? status;
