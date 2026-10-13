"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { WorkflowRun, WorkflowSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Badge, EmptyState, ErrorState, LoadingBlock, SectionHead, StatusBadge } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import { needsYou, runName } from "./status";
import s from "./workflows.module.css";

/** Runs of one workflow, named by date and main input; runs waiting on a person come first. */
export function RunsList({ workflowId, recipe, selectedRunId, onSelect }: { workflowId: string; recipe: WorkflowSummary["recipe"]; selectedRunId: string | null; onSelect: (id: string) => void }) {
  const runs = useQuery({ queryKey: ["workflow-runs", workflowId], queryFn: () => api.workflows.runs(workflowId) });
  const c = wfCopy.runs;
  const ordered = (list: WorkflowRun[]) => [...list].sort((a, b) => Number(needsYou(b.status)) - Number(needsYou(a.status)) || b.startedAt.localeCompare(a.startedAt));
  return (
    <section>
      <SectionHead id="wf-runs-h" title={c.title} aside={runs.data ? runs.data.length : undefined} />
      {runs.isPending ? (
        <LoadingBlock rows={2} label="Loading runs" />
      ) : runs.isError ? (
        <ErrorState compact error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.data.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className={s.runList} aria-label={c.caption}>
          {ordered(runs.data).map((r) => {
            const selected = r.id === selectedRunId;
            const done = r.checkpoints.filter((x) => x.status === "succeeded").length;
            const waiting = needsYou(r.status);
            return (
              <li key={r.id}>
                <button type="button" className={`${s.runRow} ${waiting ? s.runRowNeeds : ""}`} aria-current={selected ? "true" : undefined} onClick={() => onSelect(r.id)}>
                  <span className={s.runRowTop}>
                    {waiting ? <Badge tone="warn">{c.needsYou}</Badge> : null}
                    <StatusBadge kind="run" status={r.status} />
                    {selected ? <span className={s.muted}>{c.current}</span> : null}
                  </span>
                  <span className={s.runName}>{runName(r, recipe)}</span>
                  <span className={s.muted}>
                    {c.progress(done, r.checkpoints.length)} ·{" "}
                    <time dateTime={r.startedAt} title={formatDateTime(r.startedAt)}>
                      {relativeTime(r.startedAt)}
                    </time>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className={s.runsFoot}>
        <Link href="/app/runs/">{c.allActivity}</Link>
      </p>
    </section>
  );
}
