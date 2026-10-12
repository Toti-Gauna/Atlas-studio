"use client";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pause, RotateCcw, UserCheck } from "lucide-react";
import type { WorkflowDetail, WorkflowRun } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Badge, Button, Callout, Card, DescList, LoadingBlock, QueryState, SectionHead, useToast } from "@/components/ui";
import { costLabel } from "@/features/runs/RunTrace";
import { RUN_STATUS_LABEL, wfCopy } from "@/copy/workflows";
import { CheckpointList } from "./CheckpointList";
import { WF_RUN_TONE } from "./status";
import s from "./workflows.module.css";

/** Server-driven: polling only while "running"; every GET lets the preview worker process one real step. */
export function RunMonitor({ runId, workflow }: { runId: string; workflow: WorkflowDetail }) {
  const qc = useQueryClient();
  const run = useQuery({
    queryKey: ["workflow-run", runId],
    queryFn: () => api.workflowRuns.get(runId),
    refetchInterval: (q) => (q.state.data?.status === "running" ? 700 : false),
  });
  const status = run.data?.status;
  const prev = useRef(status);
  useEffect(() => {
    if (!status || prev.current === status) return;
    prev.current = status;
    // Server state moved: refresh everything derived from it (lists, badges, created artifacts).
    void qc.invalidateQueries({ queryKey: ["workflow-runs", workflow.id] });
    void qc.invalidateQueries({ queryKey: ["workflows"] });
    void qc.invalidateQueries({ queryKey: ["demo-scenarios"] });
  }, [status, qc, workflow.id]);
  const artifactCount = run.data?.checkpoints.filter((x) => x.artifactId).length ?? 0;
  useEffect(() => {
    if (artifactCount > 0) void qc.invalidateQueries({ queryKey: ["artifacts"] });
  }, [artifactCount, qc]);

  return (
    <QueryState query={run} loading={<LoadingBlock rows={4} label="Loading run" />}>
      {(r) => <RunBody run={r} workflow={workflow} />}
    </QueryState>
  );
}

function RunBody({ run, workflow }: { run: WorkflowRun; workflow: WorkflowDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canRun = useCan("workflow.run");
  const canProjects = useCan("project.read");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: canProjects });
  const c = wfCopy.run;
  const steps = workflow.versions.find((v) => v.version === run.workflowVersion)?.steps ?? workflow.current.steps;

  const apply = (r: WorkflowRun) => qc.setQueryData(["workflow-run", r.id], r);
  const onError = (title: string) => (e: unknown) => toast({ tone: "error", title, body: (e as Error).message });
  const pause = useMutation({
    mutationFn: () => api.workflowRuns.pause(run.id),
    onSuccess: (r) => {
      apply(r);
      if (r.status === "running") toast({ tone: "info", title: c.pauseToast, body: c.pauseToastBody });
    },
    onError: onError("Pause failed"),
  });
  const resume = useMutation({ mutationFn: () => api.workflowRuns.resume(run.id), onSuccess: apply, onError: onError("Resume failed") });
  const confirm = useMutation({ mutationFn: () => api.workflowRuns.confirm(run.id), onSuccess: apply, onError: onError("Confirmation failed") });

  const inputItems: Array<[string, string]> = Object.entries(run.inputs).map(([k, v]) => [k, v || "—"]);
  const projectName = projects.data?.find((p) => p.id === run.projectId)?.name ?? run.projectId;
  const currentTitle = steps.find((st) => st.key === run.currentStepKey)?.title ?? run.currentStepKey;

  return (
    <Card className={s.monitor}>
      <SectionHead title={c.title} aside={<span className="mono">{run.id}</span>} />
      <div className={s.monitorHead}>
        <div aria-live="polite" role="status" className={s.monitorStatus}>
          <Badge tone={WF_RUN_TONE[run.status]} dot>
            {RUN_STATUS_LABEL[run.status]}
          </Badge>
          <span className="sr-only">{c.live(run.status, currentTitle)}</span>
          {currentTitle && run.status !== "succeeded" ? <span className={s.muted}>· {currentTitle}</span> : null}
        </div>
        <div className={s.formFootRight}>
          {canRun && run.status === "running" ? (
            <Button icon={<Pause size={14} />} loading={pause.isPending} onClick={() => pause.mutate()}>
              {c.pause}
            </Button>
          ) : null}
          {canRun && (run.status === "paused" || run.status === "failed") ? (
            <Button variant="primary" icon={<RotateCcw size={14} />} loading={resume.isPending} onClick={() => resume.mutate()}>
              {c.resume}
            </Button>
          ) : null}
        </div>
      </div>

      {run.status === "paused" || run.status === "failed" ? <Callout tone={run.status === "failed" ? "danger" : "info"}>{run.status === "failed" ? `${c.failed} ` : null}{c.resumeNote}</Callout> : null}
      {run.status === "succeeded" ? <Callout tone="teal" icon={<CheckCircle2 size={16} aria-hidden />}>{c.succeeded}</Callout> : null}
      {run.status === "awaiting_confirmation" ? (
        <Callout tone="warn" icon={<UserCheck size={16} aria-hidden />}>
          <strong>{c.confirmTitle}</strong>
          {currentTitle ? <> — {currentTitle}</> : null}
          <p className={s.calloutP}>{c.confirmBody}</p>
          {inputItems.length ? <DescList items={inputItems} /> : null}
          {canRun ? (
            <div className={s.calloutActions}>
              <Button variant="primary" icon={<CheckCircle2 size={14} />} loading={confirm.isPending} onClick={() => confirm.mutate()}>
                {c.confirm}
              </Button>
              <Button variant="ghost" icon={<Pause size={14} />} loading={pause.isPending} onClick={() => pause.mutate()}>
                {c.pauseInstead}
              </Button>
            </div>
          ) : null}
        </Callout>
      ) : null}
      {!canRun ? <p className={s.muted}>{c.noRole}</p> : null}

      <CheckpointList run={run} steps={steps} />

      <DescList
        items={[
          [wfCopy.detail.version, `v${run.workflowVersion}`],
          [c.project, projectName],
          [c.started, <time key="s" dateTime={run.startedAt} title={formatDateTime(run.startedAt)}>{relativeTime(run.startedAt)}</time>],
          [c.updated, <time key="u" dateTime={run.updatedAt} title={formatDateTime(run.updatedAt)}>{relativeTime(run.updatedAt)}</time>],
          [c.cost, costLabel(run.costStatus, run.costNanoUsd)],
          ...(run.status !== "awaiting_confirmation" && inputItems.length ? [[c.inputs, inputItems.map(([k, v]) => `${k}: ${v}`).join(" · ")] as [string, string]] : []),
        ]}
      />
      {run.status === "running" ? <p className={s.footNote}>{c.polling}</p> : null}
    </Card>
  );
}
