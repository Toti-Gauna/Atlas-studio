"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCan, useSession } from "@/lib/state/session";
import { useAllReviews } from "@/features/deliverables/queries";

export type InboxTab = "reviews" | "support" | "privacy";

/** Which Inbox tabs a role sees and how many items in each wait on the viewer. */
export function useInbox() {
  const { data: session } = useSession();
  const canReviews = useCan("artifact.read");
  const canDecideReview = useCan("review.decide");
  const canSupport = useCan("ticket.reply_own");
  const isOperator = useCan("ticket.inbox");
  const canPrivacy = useCan("privacy.read");
  const canDecidePrivacy = useCan("privacy.admin");
  const me = session?.user.id;

  const reviews = useAllReviews(canReviews);
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: api.tickets.list, enabled: canSupport });
  const privacy = useQuery({ queryKey: ["privacy-reviews"], queryFn: api.privacy.reviews, enabled: canPrivacy });

  const counts: Record<InboxTab, number> = {
    reviews: canReviews && canDecideReview ? (reviews.data ?? []).filter((r) => r.status === "open" && r.reviewerId === me).length : 0,
    support: !canSupport ? 0 : (tickets.data ?? []).filter((t) => (isOperator ? t.status === "open" && (!t.assigneeId || t.assigneeId === me) : t.status === "pending_customer")).length,
    privacy: canPrivacy && canDecidePrivacy ? (privacy.data ?? []).filter((r) => r.status === "pending_review").length : 0,
  };
  const tabs: InboxTab[] = [canReviews ? "reviews" : null, canSupport ? "support" : null, canPrivacy ? "privacy" : null].filter((t): t is InboxTab => t !== null);
  return { tabs, counts, total: counts.reviews + counts.support + counts.privacy, isCustomer: session?.role === "customer" };
}
