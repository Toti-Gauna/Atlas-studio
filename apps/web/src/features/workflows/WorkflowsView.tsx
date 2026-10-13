"use client";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, ListOrdered, Workflow } from "lucide-react";
import type { WorkflowRun, WorkflowSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { AgentGlyph, Badge, Card, EmptyState, LinkButton, LoadingBlock, PageHeader, QueryState, SectionHead, StatusBadge, statusLabel } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import { needsYou, runName, workflowHref } from "./status";
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
          <>
            <NeedsYou workflows={list} />
            <ul className={s.cardGrid} aria-label={c.listLabel}>
              {list.map((w) => (
                <WorkflowCard key={w.id} w={w} agentName={agentOf(w.agentId)?.name ?? null} agentProfile={agentOf(w.agentId)?.profile ?? "custom"} />
              ))}
            </ul>
          </>
        )}
      </QueryState>
    </Page>
  );
}

/** Paused runs and runs waiting for a confirmation, across all workflows, first. */
function NeedsYou({ workflows }: { workflows: WorkflowSummary[] }) {
  const c = wfCopy.library;
  const withRuns = workflows.filter((w) => w.lastRunStatus);
  const runs = useQueries({
    queries: withRuns.map((w) => ({ queryKey: ["workflow-runs", w.id], queryFn: () => api.workflows.runs(w.id) })),
  });
  const waiting: Array<{ w: WorkflowSummary; r: WorkflowRun }> = withRuns.flatMap((w, i) => (runs[i]?.data ?? []).filter((r) => needsYou(r.status)).map((r) => ({ w, r })));
  if (!waiting.length) return null;
  return (
    <section className={s.needs} aria-labelledby="wf-needs-h">
      <SectionHead id="wf-needs-h" title={c.needsYou} aside={waiting.length} />
      <ul className={s.needsList} aria-label={c.needsYouCaption}>
        {waiting.map(({ w, r }) => (
          <li key={r.id} className={s.needsItem}>
            <div className={s.needsMain}>
              <div className={s.needsName}>{w.name}</div>
              <div className={s.muted}>
                {runName(r, w.recipe)} · {statusLabel("run", r.status)}
              </div>
            </div>
            <LinkButton size="sm" variant="primary" href={workflowHref(w.id, { run: r.id })}>
              {c.openRun}
            </LinkButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WorkflowCard({ w, agentName, agentProfile }: { w: WorkflowSummary; agentName: string | null; agentProfile: string }) {
  const c = wfCopy.library;
  return (
    <Card as="li" interactive className={s.wfCard}>
      <h2 className={s.wfCardTitle}>
        <Link href={workflowHref(w.id)} className={s.stretched}>
          {w.name}
        </Link>
      </h2>
      <p className={s.wfCardDesc}>{w.description}</p>
      {agentName ? (
        <div className={s.wfCardAgent}>
          <AgentGlyph profile={agentProfile} size={28} />
          <span>{agentName}</span>
        </div>
      ) : null}
      <dl className={s.wfCardMeta}>
        <div>
          <dt>{wfCopy.detail.steps}</dt>
          <dd className="tabular">
            <ListOrdered size={13} aria-hidden /> {w.stepCount}
          </dd>
        </div>
        <div>
          <dt>{c.lastRun}</dt>
          <dd>
            {w.lastRunStatus ? (
              <>
                {needsYou(w.lastRunStatus) ? <Badge tone="warn">{c.needsYou}</Badge> : null} <StatusBadge kind="run" status={w.lastRunStatus} />
              </>
            ) : (
              <span className={s.muted}>{c.neverRun}</span>
            )}
          </dd>
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
