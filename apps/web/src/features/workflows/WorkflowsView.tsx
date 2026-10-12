"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ListOrdered, Workflow } from "lucide-react";
import type { WorkflowSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, Card, EmptyState, LoadingBlock, PageHeader, QueryState } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import { runStatusLabel, runStatusTone, workflowHref } from "./status";
import s from "./workflows.module.css";

export function WorkflowsView() {
  const canAgents = useCan("agent.read");
  const workflows = useQuery({ queryKey: ["workflows"], queryFn: api.workflows.list });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list, enabled: canAgents });
  const agentOf = (id: string) => agents.data?.find((a) => a.id === id);
  const c = wfCopy.library;

  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} />
      <QueryState
        query={workflows}
        isEmpty={(d) => d.length === 0}
        loading={<LoadingBlock rows={3} label="Loading workflows" />}
        empty={<EmptyState icon={<Workflow size={22} />} title={c.emptyTitle} body={c.emptyBody} />}
      >
        {(list) => (
          <ul className={s.cardGrid} aria-label={c.listLabel}>
            {list.map((w) => (
              <WorkflowCard key={w.id} w={w} agentName={agentOf(w.agentId)?.name ?? null} agentProfile={agentOf(w.agentId)?.profile ?? "custom"} />
            ))}
          </ul>
        )}
      </QueryState>
    </Page>
  );
}

function WorkflowCard({ w, agentName, agentProfile }: { w: WorkflowSummary; agentName: string | null; agentProfile: string }) {
  const c = wfCopy.library;
  return (
    <Card as="li" interactive className={s.wfCard}>
      <div className={s.wfCardTop}>
        <Badge tone="neutral">{wfCopy.recipe[w.recipe]}</Badge>
      </div>
      <h2 className={s.wfCardTitle}>
        <Link href={workflowHref(w.id)} className={s.stretched}>
          {w.name}
        </Link>
      </h2>
      <p className={s.wfCardDesc}>{w.description}</p>
      <div className={s.wfCardAgent}>
        <AgentGlyph profile={agentProfile} size={28} />
        <span>{agentName ?? <span className="mono">{w.agentId}</span>}</span>
      </div>
      <dl className={s.wfCardMeta}>
        <div>
          <dt>{wfCopy.detail.steps}</dt>
          <dd className="tabular">
            <ListOrdered size={13} aria-hidden /> {w.stepCount}
          </dd>
        </div>
        <div>
          <dt>{wfCopy.detail.version}</dt>
          <dd className="tabular">v{w.currentVersion}</dd>
        </div>
        <div>
          <dt>{c.lastRun}</dt>
          <dd>{w.lastRunStatus ? <Badge tone={runStatusTone(w.lastRunStatus)} dot>{runStatusLabel(w.lastRunStatus)}</Badge> : <span className={s.muted}>{c.neverRun}</span>}</dd>
        </div>
      </dl>
      <div className={s.wfCardFoot}>
        <span className={s.muted}>Updated {relativeTime(w.updatedAt)}</span>
        <span className={s.openHint} aria-hidden>
          {c.open} <ArrowRight size={14} />
        </span>
      </div>
    </Card>
  );
}
