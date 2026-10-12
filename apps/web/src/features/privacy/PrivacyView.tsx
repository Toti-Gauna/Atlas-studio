"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { privacyCopy as c } from "@/copy/privacy";
import { Page } from "@/components/shell/StudioShell";
import { Callout, DemoTag, PageHeader, TabPanel, Tabs } from "@/components/ui";
import { ReviewQueue } from "./ReviewQueue";
import { ScannerTab } from "./ScannerTab";
import { ConsentsTab } from "./ConsentsTab";
import { PolicyTab } from "./PolicyTab";

type Tab = "reviews" | "scanner" | "consents" | "policy";

/** Privacy Center (R10): review before external calls, consents and policy. */
export function PrivacyView() {
  const [tab, setTab] = useState<Tab>("reviews");
  const reviews = useQuery({ queryKey: ["privacy-reviews"], queryFn: api.privacy.reviews });
  const pending = reviews.data?.filter((r) => r.status === "pending_review").length;

  return (
    <Page wide>
      <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} meta={<DemoTag />} />
      <Callout tone="info" icon={<ShieldCheck size={16} aria-hidden />}>
        <strong>{copy.disclaimers.privacy}</strong> {c.notDlp}
      </Callout>
      <div style={{ marginTop: 24 }}>
        <Tabs<Tab>
          idPrefix="privacy"
          label={c.title}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "reviews", label: c.tabs.reviews, count: pending },
            { id: "scanner", label: c.tabs.scanner },
            { id: "consents", label: c.tabs.consents },
            { id: "policy", label: c.tabs.policy },
          ]}
        />
        <div style={{ marginTop: 20 }}>
          <TabPanel idPrefix="privacy" id={tab}>
            {tab === "reviews" ? <ReviewQueue query={reviews} /> : tab === "scanner" ? <ScannerTab /> : tab === "consents" ? <ConsentsTab /> : <PolicyTab />}
          </TabPanel>
        </div>
      </div>
    </Page>
  );
}
