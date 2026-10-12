"use client";
import { useState } from "react";
import type { ReviewRequest } from "@atlas/contracts";
import { useSession } from "@/lib/state/session";
import { reviewsCopy as c } from "@/copy/reviews";
import { Page } from "@/components/shell/StudioShell";
import { DemoTag, EmptyState, LinkButton, PageHeader, QueryState, TabPanel, Tabs } from "@/components/ui";
import { useAllReviews } from "@/features/deliverables/queries";
import { ReviewsTable } from "./ReviewsTable";

type TabId = "assigned" | "requested" | "all";
const EMPTY: Record<TabId, string> = { assigned: c.page.emptyAssigned, requested: c.page.emptyRequested, all: c.page.emptyAll };
const LABEL: Record<TabId, string> = { assigned: c.page.assigned, requested: c.page.requested, all: c.page.all };

export function ReviewsView() {
  const reviews = useAllReviews();
  const { data: session } = useSession();
  const [tab, setTab] = useState<TabId>("assigned");
  const me = session?.user.id;
  const pick = (all: ReviewRequest[], t: TabId) => (t === "assigned" ? all.filter((r) => r.reviewerId === me) : t === "requested" ? all.filter((r) => r.requestedBy === me) : all);

  return (
    <Page wide>
      <PageHeader eyebrow={c.page.eyebrow} title={c.page.title} description={c.page.description} meta={<DemoTag />} />
      <QueryState query={reviews}>
        {(all) => {
          const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const rows = pick(sorted, tab);
          return (
            <>
              <Tabs<TabId>
                label={c.page.tabsLabel}
                idPrefix="reviews"
                value={tab}
                onChange={setTab}
                tabs={(["assigned", "requested", "all"] as const).map((id) => ({ id, label: LABEL[id], count: pick(sorted, id).length }))}
              />
              <TabPanel idPrefix="reviews" id={tab}>
                <div style={{ marginTop: 16 }}>
                  {rows.length === 0 ? (
                    <EmptyState title={EMPTY[tab]} body={c.page.emptyBody} action={<LinkButton href="/app/artifacts/" variant="primary">{c.page.emptyCta}</LinkButton>} />
                  ) : (
                    <ReviewsTable rows={rows} caption={c.page.caption(LABEL[tab])} />
                  )}
                </div>
              </TabPanel>
            </>
          );
        }}
      </QueryState>
    </Page>
  );
}
