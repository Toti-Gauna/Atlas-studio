"use client";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, X } from "lucide-react";
import type { PlanPreview, WorkflowDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Button, Callout, Card, ErrorState, IconButton, SectionHead, Select, Skeleton, TextField, useToast } from "@/components/ui";
import { RECIPE_INPUTS, RECIPE_PROJECT, wfCopy } from "@/copy/workflows";
import { PlanPreviewCard } from "./PlanPreviewCard";
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

export function RunSetup({ workflow, initialProjectId, onStarted }: { workflow: WorkflowDetail; initialProjectId: string | null; onStarted: (runId: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canRun = useCan("workflow.run");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? RECIPE_PROJECT[workflow.recipe] ?? null);
  const [rows, setRows] = useState<Row[]>(() => RECIPE_INPUTS[workflow.recipe].map((r) => ({ key: r.key, value: r.value, label: r.label, hint: r.hint, fixed: true })));
  const [preview, setPreview] = useState<{ plan: PlanPreview; version: number } | null>(null);
  /** Generated once per preview → run click session; reused if the user retries after an error. */
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
    onError: (e) => toast({ tone: "error", title: "Run not started", body: (e as Error).message }),
  });

  return (
    <div className={s.stack}>
      <Card>
        <SectionHead title={c.title} aside={`${c.aside} (v${workflow.currentVersion})`} />
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
        <div className={s.formFoot}>
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
          <div className={s.formFootRight}>
            <span className={s.muted}>{c.previewHint}</span>
            <Button variant={preview ? "secondary" : "primary"} icon={<Eye size={14} />} disabled={!valid} loading={previewM.isPending} onClick={() => previewM.mutate()}>
              {c.previewBtn}
            </Button>
          </div>
        </div>
      </Card>

      <div aria-live="polite">
        {previewM.isError ? <ErrorState compact error={previewM.error} onRetry={() => previewM.mutate()} /> : null}
        {preview ? (
          <PlanPreviewCard
            plan={preview.plan}
            version={preview.version}
            canRun={canRun}
            running={runM.isPending}
            onRun={() => runM.mutate()}
            onDiscard={() => {
              invalidatePreview();
              previewM.reset();
            }}
          />
        ) : previewM.isSuccess ? (
          <Callout tone="info">{c.stale}</Callout>
        ) : null}
      </div>
    </div>
  );
}
