"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Workflow } from "lucide-react";
import type { WorkflowDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, Button, EmptyState, LinkButton, LoadingBlock, PageHeader, QueryState, TabPanel, Tabs } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import { RunSetup } from "./RunSetup";
import { RunMonitor } from "./RunMonitor";
import { RunsList } from "./RunsList";
import { StepsEditor } from "./StepsEditor";
import { VersionHistory } from "./VersionHistory";
import { workflowHref } from "./status";
import s from "./workflows.module.css";

type Tab = "run" | "steps" | "versions";

export function WorkflowView() {
  const params = useSearchParams();
  const id = params.get("id");
  const workflow = useQuery({ queryKey: ["workflow", id], queryFn: () => api.workflows.get(id!), enabled: Boolean(id) });

  if (!id) {
    return (
      <Page>
        <EmptyState icon={<Workflow size={22} />} title={wfCopy.detail.missingId} body={wfCopy.detail.missingIdBody} action={<LinkButton href="/app/workflows/">{wfCopy.detail.back}</LinkButton>} />
      </Page>
    );
  }
  return (
    <Page wide>
      <QueryState query={workflow} loading={<LoadingBlock rows={4} label="Loading workflow" />}>
        {(w) => <WorkflowScreen w={w} runId={params.get("run")} projectParam={params.get("project")} />}
      </QueryState>
    </Page>
  );
}

function WorkflowScreen({ w, runId, projectParam }: { w: WorkflowDetail; runId: string | null; projectParam: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("run");
  const canAgents = useCan("agent.read");
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list, enabled: canAgents });
  const agent = agents.data?.find((a) => a.id === w.agentId);
  const c = wfCopy.detail;

  const selectRun = (rid: string | null) => {
    setTab("run");
    router.replace(workflowHref(w.id, { run: rid, project: rid ? null : projectParam }), { scroll: false });
  };

  return (
    <>
      <Link href="/app/workflows/" className={s.back}>
        <ArrowLeft size={14} aria-hidden /> {c.back}
      </Link>
      <PageHeader
        eyebrow={wfCopy.recipe[w.recipe]}
        title={w.name}
        description={w.description}
        meta={
          <>
            <Badge tone="neutral" mono>
              v{w.currentVersion}
            </Badge>
            <Badge tone="neutral">{w.stepCount} steps</Badge>
            <span className={s.agentChip}>
              <AgentGlyph profile={agent?.profile ?? "custom"} size={22} />
              <span>
                <span className="sr-only">{c.agent}: </span>
                {agent?.name ?? w.agentId}
              </span>
            </span>
          </>
        }
      />
      <div className={s.detailGrid}>
        <div className={s.mainCol}>
          <Tabs<Tab>
            idPrefix="wf"
            label={c.tabsLabel}
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "run", label: c.tabRun },
              { id: "steps", label: c.tabSteps, count: w.current.steps.length },
              { id: "versions", label: c.tabVersions, count: w.versions.length },
            ]}
          />
          {tab === "run" ? (
            <TabPanel idPrefix="wf" id="run">
              {runId ? (
                <div className={s.stack}>
                  <RunMonitor key={runId} runId={runId} workflow={w} />
                  <div>
                    <Button onClick={() => selectRun(null)}>{wfCopy.run.newRun}</Button>
                  </div>
                </div>
              ) : (
                <RunSetup key={w.currentVersion} workflow={w} initialProjectId={projectParam} onStarted={(rid) => selectRun(rid)} />
              )}
            </TabPanel>
          ) : null}
          {tab === "steps" ? (
            <TabPanel idPrefix="wf" id="steps">
              <StepsEditor key={w.currentVersion} workflow={w} />
            </TabPanel>
          ) : null}
          {tab === "versions" ? (
            <TabPanel idPrefix="wf" id="versions">
              <VersionHistory workflow={w} />
            </TabPanel>
          ) : null}
        </div>
        <aside className={s.sideCol} aria-labelledby="wf-runs-h">
          <RunsList workflowId={w.id} selectedRunId={runId} onSelect={selectRun} />
        </aside>
      </div>
    </>
  );
}
