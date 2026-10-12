"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/components/shell/StudioShell";
import { DemoTag, PageHeader, TabPanel, Tabs } from "@/components/ui";
import { settingsCopy as c } from "@/copy/settings";
import { WorkspaceTab } from "./WorkspaceTab";
import { MembersTab } from "./MembersTab";
import { ProvidersTab } from "./ProvidersTab";
import { ModelsTab } from "./ModelsTab";
import { RoutingTab } from "./RoutingTab";
import { AuditTab } from "./AuditTab";
import s from "./settings.module.css";

const TABS = ["workspace", "members", "providers", "models", "routing", "audit"] as const;
type Tab = (typeof TABS)[number];

export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "workspace";
  const setTab = (t: Tab) => router.replace(`/app/settings/?tab=${t}`, { scroll: false });

  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} meta={<DemoTag />} />
      <Tabs idPrefix="settings" label={c.tabsLabel} value={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: c.tabs[id] }))} />
      <TabPanel idPrefix="settings" id={tab}>
        <div className={s.body}>
          {tab === "workspace" ? <WorkspaceTab /> : null}
          {tab === "members" ? <MembersTab /> : null}
          {tab === "providers" ? <ProvidersTab /> : null}
          {tab === "models" ? <ModelsTab /> : null}
          {tab === "routing" ? <RoutingTab /> : null}
          {tab === "audit" ? <AuditTab /> : null}
        </div>
      </TabPanel>
    </Page>
  );
}
