"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { inboxCopy as c } from "@/copy/inbox";
import { Page } from "@/components/shell/StudioShell";
import { PageHeader, TabPanel, Tabs } from "@/components/ui";
import { ReviewsSection } from "@/features/reviews/ReviewsSection";
import { SupportSection } from "@/features/desk/SupportSection";
import { ReviewQueue } from "@/features/privacy/ReviewQueue";
import { useInbox, type InboxTab } from "./useInbox";
import s from "./inbox.module.css";

function PrivacySection() {
  const reviews = useQuery({ queryKey: ["privacy-reviews"], queryFn: api.privacy.reviews });
  return (
    <>
      <p className={s.note}>{c.privacyNote}</p>
      <ReviewQueue query={reviews} />
    </>
  );
}

function Section({ tab }: { tab: InboxTab }) {
  return <div className={s.body}>{tab === "reviews" ? <ReviewsSection /> : tab === "support" ? <SupportSection /> : <PrivacySection />}</div>;
}

/** One place for everything waiting on a person; tabs depend on the role. */
export function InboxView() {
  const router = useRouter();
  const params = useSearchParams();
  const { tabs, counts, isCustomer } = useInbox();
  const raw = params.get("tab") as InboxTab | null;
  const fallback = tabs.find((t) => counts[t] > 0) ?? tabs[0];
  const tab = raw && tabs.includes(raw) ? raw : fallback;
  const setTab = (t: InboxTab) => router.replace(`/app/inbox/?tab=${t}`, { scroll: false });

  if (isCustomer) {
    return (
      <Page wide>
        <PageHeader title={c.customerTitle} description={c.customerDescription} />
        <SupportSection />
      </Page>
    );
  }

  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} />
      {tab ? (
        <>
          {tabs.length > 1 ? (
            <>
              <Tabs<InboxTab> idPrefix="inbox" label={c.tabsLabel} value={tab} onChange={setTab} tabs={tabs.map((id) => ({ id, label: c.tabs[id], count: counts[id] || undefined }))} />
              <TabPanel idPrefix="inbox" id={tab}>
                <Section tab={tab} />
              </TabPanel>
            </>
          ) : (
            <Section tab={tab} />
          )}
        </>
      ) : null}
    </Page>
  );
}
