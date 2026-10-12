"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Inbox, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { privacyCopy as c } from "@/copy/privacy";
import { Page } from "@/components/shell/StudioShell";
import { Callout, PageHeader, TabPanel, Tabs } from "@/components/ui";
import { ScannerTab } from "./ScannerTab";
import { ConsentsTab } from "./ConsentsTab";
import { PolicyTab } from "./PolicyTab";

type Tab = "scanner" | "consents" | "policy";

/** Privacy Center (R10): review before external calls, consents and policy. */
export function PrivacyView() {
  const [tab, setTab] = useState<Tab>("scanner");
  const reviews = useQuery({ queryKey: ["privacy-reviews"], queryFn: api.privacy.reviews });
  const pending = reviews.data?.filter((r) => r.status === "pending_review").length;

  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} />
      <Callout tone="info" icon={<ShieldCheck size={16} aria-hidden />}>
        <strong>{copy.disclaimers.privacy}</strong> {c.notDlp}
      </Callout>
      {pending ? (
        <div style={{ marginTop: 12 }}>
          <Callout tone="warn" icon={<Inbox size={16} aria-hidden />}>
            {c.pendingInInbox(pending)} <Link href="/app/inbox/?tab=privacy">{c.openInbox}</Link>
          </Callout>
        </div>
      ) : null}
      <div style={{ marginTop: 24 }}>
        <Tabs<Tab>
          idPrefix="privacy"
          label={c.title}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "scanner", label: c.tabs.scanner },
            { id: "consents", label: c.tabs.consents },
            { id: "policy", label: c.tabs.policy },
          ]}
        />
        <div style={{ marginTop: 20 }}>
          <TabPanel idPrefix="privacy" id={tab}>
            {tab === "scanner" ? <ScannerTab /> : tab === "consents" ? <ConsentsTab /> : <PolicyTab />}
          </TabPanel>
        </div>
      </div>
    </Page>
  );
}
