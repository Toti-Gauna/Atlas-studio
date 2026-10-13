"use client";
import { useState } from "react";
import type { ReviewRequest } from "@atlas/contracts";
import { useSession } from "@/lib/state/session";
import { reviewsCopy as c } from "@/copy/reviews";
import { EmptyState, LinkButton, QueryState, Segmented } from "@/components/ui";
import { useAllReviews } from "@/features/deliverables/queries";
import { ReviewsTable } from "./ReviewsTable";
import s from "./reviews.module.css";

type TabId = "assigned" | "requested" | "all";
const EMPTY: Record<TabId, string> = { assigned: c.page.emptyAssigned, requested: c.page.emptyRequested, all: c.page.emptyAll };
const LABEL: Record<TabId, string> = { assigned: c.page.assigned, requested: c.page.requested, all: c.page.all };

/** Review requests (Inbox › Reviews). */
export function ReviewsSection() {
  const reviews = useAllReviews();
  const { data: session } = useSession();
  const [tab, setTab] = useState<TabId>("assigned");
  const me = session?.user.id;
  const pick = (all: ReviewRequest[], t: TabId) => (t === "assigned" ? all.filter((r) => r.reviewerId === me) : t === "requested" ? all.filter((r) => r.requestedBy === me) : all);

  return (
    <QueryState query={reviews}>
        {(all) => {
          const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const rows = pick(sorted, tab);
          return (
            <>
              <div className={s.tabs}>
                <Segmented<TabId>
                  label={c.page.tabsLabel}
                  value={tab}
                  onChange={setTab}
                  options={(["assigned", "requested", "all"] as const).map((id) => ({ value: id, label: `${LABEL[id]} · ${pick(sorted, id).length}` }))}
                />
              </div>
              {rows.length === 0 ? (
                <EmptyState title={EMPTY[tab]} body={c.page.emptyBody} action={<LinkButton href="/app/artifacts/" variant="primary">{c.page.emptyCta}</LinkButton>} />
              ) : (
                <ReviewsTable rows={rows} caption={c.page.caption(LABEL[tab])} me={me} />
              )}
            </>
          );
        }}
    </QueryState>
  );
}
