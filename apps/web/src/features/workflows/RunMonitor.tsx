"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pause, PauseCircle, RotateCcw, UserCheck } from "lucide-react";
import type { WorkflowDetail, WorkflowRun } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, money, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Button, Callout, Card, DescList, LoadingBlock, QueryState, SectionHead, StatusBadge, TechDetails, statusLabel, useToast } from "@/components/ui";
import { inputLabel, wfCopy } from "@/copy/workflows";
import { CheckpointList } from "./CheckpointList";
import { runName } from "./status";
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

function costText(run: WorkflowRun) {
  if (run.costStatus === "no_provider_charge") return wfCopy.run.costLocal;
  if (run.costStatus === "unknown" || run.costNanoUsd === null) return wfCopy.run.costUnknown;
  return money(run.costNanoUsd);
}

function RunBody({ run, workflow }: { run: WorkflowRun; workflow: WorkflowDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canRun = useCan("workflow.run");
  const canProjects = useCan("project.read");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list, enabled: canProjects });
  const c = wfCopy.run;
  const steps = workflow.versions.find((v) => v.version === run.workflowVersion)?.steps ?? workflow.current.steps;
  const titleOf = (key: string | null) => (key ? (steps.find((st) => st.key === key)?.title ?? key) : null);

  const apply = (r: WorkflowRun) => qc.setQueryData(["workflow-run", r.id], r);
  const onError = (title: string) => (e: unknown) => toast({ tone: "error", title, body: (e as Error).message });
  const pause = useMutation({
    mutationFn: () => api.workflowRuns.pause(run.id),
    onSuccess: (r) => {
      apply(r);
      if (r.status === "running") toast({ tone: "info", title: c.pauseToast, body: c.pauseToastBody });
    },
    onError: onError(c.pauseFailed),
  });
  const resume = useMutation({ mutationFn: () => api.workflowRuns.resume(run.id), onSuccess: apply, onError: onError(c.resumeFailed) });
  const confirm = useMutation({ mutationFn: () => api.workflowRuns.confirm(run.id), onSuccess: apply, onError: onError(c.confirmFailed) });

  const inputItems: Array<[string, string]> = Object.entries(run.inputs).map(([k, v]) => [inputLabel(workflow.recipe, k), v || "—"]);
  const projectName = projects.data?.find((p) => p.id === run.projectId)?.name ?? run.projectId;
  const currentTitle = titleOf(run.currentStepKey);
  const lastDone = [...run.checkpoints].reverse().find((x) => x.status === "succeeded");
  const resumeButton =
    canRun && (run.status === "paused" || run.status === "failed") ? (
      <div className={s.calloutActions}>
        <Button variant="primary" icon={<RotateCcw size={14} />} loading={resume.isPending} onClick={() => resume.mutate()}>
          {c.resume}
        </Button>
      </div>
    ) : null;

  return (
    <Card className={s.monitor}>
      <SectionHead title={runName(run, workflow.recipe)} />
      <div className={s.monitorHead}>
        <div aria-live="polite" role="status" className={s.monitorStatus}>
          <StatusBadge kind="run" status={run.status} />
          <span className="sr-only">{c.live(statusLabel("run", run.status), currentTitle)}</span>
          {currentTitle && run.status !== "succeeded" ? <span className={s.muted}>· {currentTitle}</span> : null}
        </div>
        {canRun && run.status === "running" ? (
          <Button icon={<Pause size={14} />} loading={pause.isPending} onClick={() => pause.mutate()}>
            {c.pause}
          </Button>
        ) : null}
      </div>

      {run.status === "paused" ? (
        <Callout tone="warn" icon={<PauseCircle size={16} aria-hidden />}>
          <strong>{c.pausedWhy(titleOf(lastDone?.stepKey ?? null), relativeTime(run.updatedAt))}</strong>
          {currentTitle ? <> {c.nextStep(currentTitle)}</> : null} {c.resumeNote}
          {resumeButton}
        </Callout>
      ) : null}
      {run.status === "failed" ? (
        <Callout tone="danger">
          {c.failed} {c.resumeNote}
          {resumeButton}
        </Callout>
      ) : null}
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
          [c.project, canProjects ? <Link key="p" href={`/app/project/?id=${run.projectId}`}>{projectName}</Link> : projectName],
          [c.started, <time key="s" dateTime={run.startedAt} title={formatDateTime(run.startedAt)}>{relativeTime(run.startedAt)}</time>],
          [c.updated, <time key="u" dateTime={run.updatedAt} title={formatDateTime(run.updatedAt)}>{relativeTime(run.updatedAt)}</time>],
          [c.cost, costText(run)],
          ...(run.status !== "awaiting_confirmation" && inputItems.length ? [[c.inputs, inputItems.map(([k, v]) => `${k}: ${v}`).join(" · ")] as [string, string]] : []),
        ]}
      />
      {run.status === "running" ? <p className={s.footNote}>{c.polling}</p> : null}
      <TechDetails>
        <p>
          Run <span className="mono">{run.id}</span> · workflow version {run.workflowVersion}
        </p>
        <ul className={s.techList}>
          {run.checkpoints.map((cp) => {
            const def = steps.find((st) => st.key === cp.stepKey);
            return (
              <li key={cp.stepKey}>
                <span className="mono">{cp.stepKey}</span> · tool <span className="mono">{def?.tool ?? "none"}</span> · attempts {cp.attempt} · idempotency key <span className="mono">{cp.idempotencyKey}</span>
              </li>
            );
          })}
        </ul>
      </TechDetails>
    </Card>
  );
}
