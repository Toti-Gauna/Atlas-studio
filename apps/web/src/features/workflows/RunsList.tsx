"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Badge, EmptyState, ErrorState, LoadingBlock, SectionHead } from "@/components/ui";
import { RUN_STATUS_LABEL, wfCopy } from "@/copy/workflows";
import { WF_RUN_TONE } from "./status";
import s from "./workflows.module.css";

export function RunsList({ workflowId, selectedRunId, onSelect }: { workflowId: string; selectedRunId: string | null; onSelect: (id: string) => void }) {
  const runs = useQuery({ queryKey: ["workflow-runs", workflowId], queryFn: () => api.workflows.runs(workflowId) });
  const c = wfCopy.runs;
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
          {runs.data.map((r) => {
            const selected = r.id === selectedRunId;
            const done = r.checkpoints.filter((x) => x.status === "succeeded").length;
            return (
              <li key={r.id}>
                <button type="button" className={s.runRow} aria-current={selected ? "true" : undefined} onClick={() => onSelect(r.id)}>
                  <span className={s.runRowTop}>
                    <Badge tone={WF_RUN_TONE[r.status]} dot>
                      {RUN_STATUS_LABEL[r.status]}
                    </Badge>
                    {selected ? <span className={s.muted}>{c.current}</span> : null}
                  </span>
                  <span className={`mono ${s.runId}`}>{r.id}</span>
                  <span className={s.muted}>
                    v{r.workflowVersion} · {done}/{r.checkpoints.length} steps ·{" "}
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
    </section>
  );
}
