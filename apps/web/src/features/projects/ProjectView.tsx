"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderSearch } from "lucide-react";
import type { Project, Suggestion } from "@atlas/contracts";
import { api } from "@/lib/api";
import { setDraft } from "@/lib/state/drafts";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { Button, EmptyState, ErrorState, LinkButton, LoadingBlock, PageHeader, SectionHead, Select, Skeleton, TabPanel, Tabs, type TabDef } from "@/components/ui";
import { projectsCopy as P } from "@/copy/projects";
import { Recommendations } from "@/features/chat/Recommendations";
import { MemoryPanel } from "./MemoryPanel";
import { ProjectHeader, ProjectSetup } from "./ProjectHeader";
import { ConversationRows, ConversationsTab, DeliverableRows, DeliverablesTab, SourcesTab } from "./ProjectLists";
import s from "./projects.module.css";

type Tab = "overview" | "conversations" | "sources" | "deliverables" | "memory";
const TAB_IDS: Tab[] = ["overview", "conversations", "sources", "deliverables", "memory"];
const BACK = { href: "/app/projects/", label: P.detail.backToList };

export function ProjectView() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) {
    return (
      <Page>
        <EmptyState icon={<FolderSearch size={22} />} title={P.detail.missingId} body={P.detail.missingIdBody} action={<LinkButton href={BACK.href}>{BACK.label}</LinkButton>} />
      </Page>
    );
  }
  const raw = params.get("tab");
  return <ProjectDetail key={id} id={id} tab={TAB_IDS.includes(raw as Tab) ? (raw as Tab) : "overview"} />;
}

/** Overview: objective, what happened lately, what is waiting, and what to do next. */
function Overview({ project, onTab }: { project: Project; onTab: (t: Tab) => void }) {
  const D = P.detail;
  const router = useRouter();
  const canChat = useCan("conversation.use");
  const conversations = useQuery({ queryKey: ["conversations", project.id], queryFn: () => api.conversations.list(project.id), enabled: canChat });
  const artifacts = useQuery({ queryKey: ["artifacts", project.id], queryFn: () => api.artifacts.list(project.id) });
  const recent = (conversations.data ?? []).slice(0, 3);
  const inProgress = (artifacts.data ?? []).filter((a) => a.reviewState !== "approved").slice(0, 3);
  const prepare = (sg: Suggestion) => {
    const agent = sg.agentId ?? project.defaultAgentId;
    setDraft(`new:${project.id}`, sg.prompt);
    router.push(`/app/chat/?new=1&project=${project.id}${agent ? `&agent=${agent}` : ""}&mode=${sg.workMode}`);
  };
  const viewAll = (t: Tab) => (
    <Button size="sm" variant="ghost" onClick={() => onTab(t)}>
      {D.viewAll}
    </Button>
  );
  return (
    <div className={s.overview}>
      <ProjectSetup project={project} />
      <div className={s.overviewGrid}>
        {canChat ? (
          <section aria-labelledby="proj-recent-h" className={s.overviewBlock}>
            <SectionHead id="proj-recent-h" title={D.recentConversations} aside={project.conversationCount > 3 ? viewAll("conversations") : undefined} />
            {conversations.isPending ? (
              <LoadingBlock rows={2} />
            ) : conversations.isError ? (
              <ErrorState error={conversations.error} compact onRetry={() => void conversations.refetch()} />
            ) : recent.length ? (
              <ConversationRows list={recent} label={D.recentConversations} />
            ) : (
              <p className={s.emptyLine}>{D.noConversationsBody}</p>
            )}
          </section>
        ) : null}
        <section aria-labelledby="proj-progress-h" className={s.overviewBlock}>
          <SectionHead id="proj-progress-h" title={D.inProgress} aside={project.artifactCount > 0 ? viewAll("deliverables") : undefined} />
          {artifacts.isPending ? (
            <LoadingBlock rows={2} />
          ) : artifacts.isError ? (
            <ErrorState error={artifacts.error} compact onRetry={() => void artifacts.refetch()} />
          ) : inProgress.length ? (
            <DeliverableRows list={inProgress} label={D.inProgress} />
          ) : (
            <p className={s.emptyLine}>{artifacts.data.length ? D.noneInProgress : D.noDeliverablesBody}</p>
          )}
        </section>
      </div>
      <section aria-labelledby="proj-reco-h">
        <SectionHead id="proj-reco-h" title={D.suggestions} />
        <Recommendations projectId={project.id} agentId={project.defaultAgentId ?? undefined} onUse={prepare} limit={4} />
      </section>
    </div>
  );
}

function ProjectDetail({ id, tab }: { id: string; tab: Tab }) {
  const D = P.detail;
  const router = useRouter();
  const q = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get(id) });
  // The active tab lives in the URL so it can be shared and survives Back.
  const setTab = (t: Tab) => router.replace(`/app/project/?id=${id}${t === "overview" ? "" : `&tab=${t}`}`, { scroll: false });

  if (q.isPending)
    return (
      <Page wide>
        <Skeleton lines={2} height={22} />
        <div className={s.loadingGap}>
          <LoadingBlock rows={3} />
        </div>
      </Page>
    );
  if (q.isError)
    return (
      <Page wide>
        <PageHeader back={BACK} title={D.unavailable} />
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
      {/* Below 640px five tabs don't fit: a select shows every section at once. */}
      <div className={s.tabsSelect}>
        <Select
          label={D.tabsLabel}
          hideLabel
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
          options={tabs.map((t) => ({ value: t.id, label: t.count !== undefined ? D.tabWithCount(t.label, t.count) : t.label }))}
        />
      </div>
      <div className={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} label={D.tabsLabel} idPrefix="proj" />
      </div>
      <div className={s.tabBody}>
        <TabPanel idPrefix="proj" id={tab}>
          {tab === "overview" ? <Overview project={project} onTab={setTab} /> : null}
          {tab === "conversations" ? <ConversationsTab project={project} /> : null}
          {tab === "sources" ? <SourcesTab project={project} /> : null}
          {tab === "deliverables" ? <DeliverablesTab project={project} /> : null}
          {tab === "memory" ? <MemoryPanel project={project} /> : null}
        </TabPanel>
      </div>
    </Page>
  );
}

