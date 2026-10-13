"use client";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Play, Plus, X } from "lucide-react";
import type { PlanPreview as Plan, WorkflowDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Button, Callout, Card, ErrorState, IconButton, SectionHead, Select, Skeleton, TextField, useToast } from "@/components/ui";
import { RECIPE_INPUTS, RECIPE_PROJECT, planCopy, wfCopy } from "@/copy/workflows";
import { PlanPreview } from "./PlanPreview";
import { newIdempotencyKey } from "./status";
import s from "./workflows.module.css";

interface Row {
  key: string;
  value: string;
  label?: string;
  hint?: string;
  fixed: boolean;
}

const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * Run setup: the recipe's inputs and one "Review & run" button. The plan opens
 * in the same panel and the Run button lives under it, so nothing runs before
 * the plan has been seen. Extra free-form inputs are for workflow editors only.
 */
export function RunSetup({ workflow, initialProjectId, onStarted }: { workflow: WorkflowDetail; initialProjectId: string | null; onStarted: (runId: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canRun = useCan("workflow.run");
  const canEdit = useCan("workflow.write");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? RECIPE_PROJECT[workflow.recipe] ?? null);
  const [rows, setRows] = useState<Row[]>(() => RECIPE_INPUTS[workflow.recipe].map((r) => ({ key: r.key, value: r.value, label: r.label, hint: r.hint, fixed: true })));
  const [preview, setPreview] = useState<{ plan: Plan; version: number } | null>(null);
  /** Generated once per review → run click session; reused if the user retries after an error. */
  const idemKey = useRef<string | null>(null);
  const c = wfCopy.setup;

  const effectiveProject = projects.data?.some((p) => p.id === projectId) ? projectId : (projects.data?.[0]?.id ?? null);
  const inputs = useMemo(() => Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])), [rows]);
  const rowErrors = rows.map((r, i) => {
    if (r.fixed) return r.value.length > 2000 ? c.valueTooLong : null;
    if (!KEY_RE.test(r.key)) return c.keyInvalid;
    if (rows.findIndex((x) => x.key === r.key) !== i) return c.keyDuplicate;
    return r.value.length > 2000 ? c.valueTooLong : null;
  });
  const valid = Boolean(effectiveProject) && rowErrors.every((e) => !e);

  const invalidatePreview = () => {
    setPreview(null);
    idemKey.current = null;
  };
  const setRow = (i: number, patch: Partial<Row>) => {
    invalidatePreview();
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const previewM = useMutation({
    mutationFn: () => api.workflows.preview(workflow.id, { projectId: effectiveProject!, inputs }),
    onSuccess: (plan) => {
      idemKey.current = null;
      setPreview({ plan, version: workflow.currentVersion });
    },
  });
  const runM = useMutation({
    mutationFn: () => {
      idemKey.current ??= newIdempotencyKey();
      return api.workflows.run(workflow.id, { projectId: effectiveProject!, version: preview!.version, inputs, idempotencyKey: idemKey.current });
    },
    onSuccess: (run) => {
      idemKey.current = null;
      qc.setQueryData(["workflow-run", run.id], run);
      void qc.invalidateQueries({ queryKey: ["workflow-runs", workflow.id] });
      void qc.invalidateQueries({ queryKey: ["workflows"] });
      void qc.invalidateQueries({ queryKey: ["demo-scenarios"] });
      onStarted(run.id);
    },
    onError: (e) => toast({ tone: "error", title: c.runFailed, body: (e as Error).message }),
  });
  const blocked = Boolean(preview?.plan.routing.blocked);

  return (
    <Card className={s.setup}>
      <SectionHead title={c.title} />
      <div className={s.formGrid}>
        {projects.isPending ? (
          <Skeleton lines={1} height={38} />
        ) : projects.isError ? (
          <ErrorState compact error={projects.error} onRetry={() => void projects.refetch()} />
        ) : (
          <Select
            label={c.project}
            hint={c.projectHint}
            value={effectiveProject ?? ""}
            onChange={(e) => {
              invalidatePreview();
              setProjectId(e.target.value);
            }}
            options={projects.data.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        {rows.map((r, i) =>
          r.fixed ? (
            <TextField key={`f-${r.key}`} label={r.label ?? r.key} hint={r.hint} error={rowErrors[i]} value={r.value} maxLength={2000} onChange={(e) => setRow(i, { value: e.target.value })} />
          ) : (
            <div key={`x-${i}`} className={s.kvRow}>
              <TextField label={c.inputKey} value={r.key} error={rowErrors[i]} onChange={(e) => setRow(i, { key: e.target.value })} />
              <TextField label={c.inputValue} value={r.value} maxLength={2000} onChange={(e) => setRow(i, { value: e.target.value })} />
              <IconButton
                label={c.removeInput(r.key || String(i + 1))}
                className={s.kvRemove}
                onClick={() => {
                  invalidatePreview();
                  setRows((rs) => rs.filter((_, j) => j !== i));
                }}
              >
                <X size={16} />
              </IconButton>
            </div>
          ),
        )}
      </div>

      {!preview ? (
        <div className={s.formFoot}>
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus size={14} />}
              onClick={() => {
                invalidatePreview();
                setRows((rs) => [...rs, { key: "", value: "", fixed: false }]);
              }}
            >
              {c.addInput}
            </Button>
          ) : null}
          <div className={s.formFootRight}>
            <span className={s.muted}>{c.reviewHint}</span>
            <Button variant="primary" icon={<Eye size={14} />} disabled={!valid} loading={previewM.isPending} onClick={() => previewM.mutate()}>
              {c.review}
            </Button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite">
        {previewM.isError ? <ErrorState compact error={previewM.error} onRetry={() => previewM.mutate()} /> : null}
        {preview ? (
          <section className={s.planPanel} aria-label={planCopy.titleVersion(preview.version)}>
            <SectionHead title={planCopy.titleVersion(preview.version)} aside={planCopy.nothingRuns} />
            <PlanPreview
              plan={preview.plan}
              footer={
                <div className={s.previewFoot}>
                  <span className={s.muted}>{canRun ? c.runHint : c.noRunRole}</span>
                  <div className={s.formFootRight}>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        invalidatePreview();
                        previewM.reset();
                      }}
                    >
                      {c.editInputs}
                    </Button>
                    <Button variant="primary" icon={<Play size={14} />} disabled={!canRun || blocked} loading={runM.isPending} onClick={() => runM.mutate()}>
                      {c.run}
                    </Button>
                  </div>
                </div>
              }
            />
          </section>
        ) : previewM.isSuccess ? (
          <Callout tone="info">{c.stale}</Callout>
        ) : null}
      </div>
    </Card>
  );
}
