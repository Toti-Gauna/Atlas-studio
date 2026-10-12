"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderSearch } from "lucide-react";
import type { Project, Suggestion } from "@atlas/contracts";
import { api } from "@/lib/api";
import { setDraft } from "@/lib/state/drafts";
import { Page } from "@/components/shell/StudioShell";
import { EmptyState, ErrorState, LoadingBlock, SectionHead, Skeleton, TabPanel, Tabs, type TabDef } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";
import { Recommendations } from "@/features/chat/Recommendations";
import { MemoryPanel } from "./MemoryPanel";
import { ProjectHeader } from "./ProjectHeader";
import { ConversationsTab, DeliverablesTab, SourcesTab } from "./ProjectLists";
import s from "./projects.module.css";

type Tab = "overview" | "conversations" | "sources" | "deliverables" | "memory";
const TAB_IDS: Tab[] = ["overview", "conversations", "sources", "deliverables", "memory"];

export function ProjectView() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) {
    return (
      <Page>
        <EmptyState icon={<FolderSearch size={22} />} title={P.detail.missingId} body={P.detail.missingIdBody} action={<Link href="/app/projects/">{P.detail.backToList}</Link>} />
      </Page>
    );
  }
  const initial = params.get("tab");
  return <ProjectDetail key={id} id={id} initialTab={TAB_IDS.includes(initial as Tab) ? (initial as Tab) : "overview"} />;
}

function Overview({ project }: { project: Project }) {
  const router = useRouter();
  const prepare = (sg: Suggestion) => {
    const agent = sg.agentId ?? project.defaultAgentId;
    setDraft(`new:${project.id}`, sg.prompt);
    router.push(`/app/chat/?new=1&project=${project.id}${agent ? `&agent=${agent}` : ""}&mode=${sg.workMode}`);
  };
  return (
    <section aria-labelledby="proj-reco-h">
      <SectionHead id="proj-reco-h" title={P.detail.suggestions} aside={P.detail.suggestionsAside} />
      <Recommendations projectId={project.id} agentId={project.defaultAgentId ?? undefined} onUse={prepare} limit={6} />
    </section>
  );
}

function ProjectDetail({ id, initialTab }: { id: string; initialTab: Tab }) {
  const D = P.detail;
  const [tab, setTab] = useState<Tab>(initialTab);
  const q = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get(id) });

  if (q.isPending)
    return (
      <Page wide>
        <Skeleton lines={2} height={22} />
        <div style={{ marginTop: 24 }}>
          <LoadingBlock rows={3} />
        </div>
      </Page>
    );
  if (q.isError)
    return (
      <Page wide>
        <Link href="/app/projects/" className={s.back}>
          {D.backToList}
        </Link>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );

  const project = q.data;
  const tabs: Array<TabDef<Tab>> = [
    { id: "overview", label: D.tabs.overview },
    { id: "conversations", label: D.tabs.conversations, count: project.conversationCount },
    { id: "sources", label: D.tabs.sources, count: project.documentCount },
    { id: "deliverables", label: D.tabs.deliverables, count: project.artifactCount },
    { id: "memory", label: D.tabs.memory },
  ];

  return (
    <Page wide>
      <ProjectHeader project={project} />
      <div className={s.tabsWrap}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} label={D.tabsLabel} idPrefix="proj" />
      </div>
      <div className={s.tabBody}>
        <TabPanel idPrefix="proj" id={tab}>
          {tab === "overview" ? <Overview project={project} /> : null}
          {tab === "conversations" ? <ConversationsTab project={project} /> : null}
          {tab === "sources" ? <SourcesTab project={project} /> : null}
          {tab === "deliverables" ? <DeliverablesTab project={project} /> : null}
          {tab === "memory" ? <MemoryPanel project={project} /> : null}
        </TabPanel>
      </div>
    </Page>
  );
}
