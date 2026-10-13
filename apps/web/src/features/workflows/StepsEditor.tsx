"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Save } from "lucide-react";
import type { ToolDescriptor, ToolId, WorkflowDetail, WorkflowStepDef } from "@atlas/contracts";
import { api, isApiError } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { Button, Callout, Card, ErrorState, SectionHead, Select, Skeleton, TextField, useToast } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import { StepRow } from "./StepRow";
import { effectLabel } from "./PlanPreview";
import s from "./workflows.module.css";

const MAX_STEPS = 12;
const NO_TOOL = "__none__";

function uniqueKey(base: string, steps: WorkflowStepDef[]): string {
  const root = base.slice(0, 34);
  if (!steps.some((x) => x.key === root)) return root;
  let i = 2;
  while (steps.some((x) => x.key === `${root}_${i}`)) i++;
  return `${root}_${i}`;
}

function stepFromTool(tool: ToolDescriptor | null, steps: WorkflowStepDef[]): WorkflowStepDef {
  if (!tool) return { key: uniqueKey("confirm", steps), title: "Confirm before continuing", tool: null, invokesModel: false, requiresConfirmation: true, effect: "none", inputHint: "" };
  return {
    key: uniqueKey(tool.id, steps),
    title: tool.name,
    tool: tool.id,
    invokesModel: tool.id === "draft_artifact" || !tool.deterministic,
    requiresConfirmation: tool.effect === "requires_confirmation",
    effect: tool.id === "draft_artifact" ? "creates_artifact" : tool.id === "handoff_to_human" ? "creates_ticket" : "none",
    inputHint: tool.description.slice(0, 300),
  };
}

export function StepsEditor({ workflow }: { workflow: WorkflowDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canWrite = useCan("workflow.write");
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const [steps, setSteps] = useState<WorkflowStepDef[]>(() => structuredClone(workflow.current.steps));
  const [toolPick, setToolPick] = useState<string>(NO_TOOL);
  const [note, setNote] = useState("");
  const c = wfCopy.editor;

  const dirty = JSON.stringify(steps) !== JSON.stringify(workflow.current.steps);
  const valid = steps.length > 0 && steps.every((x) => x.title.trim() && x.title.length <= 120 && x.inputHint.length <= 300) && note.length <= 200;

  const save = useMutation({
    mutationFn: () => api.workflows.update(workflow.id, { baseVersion: workflow.currentVersion, steps: steps.map((x) => ({ ...x, title: x.title.trim() })), changeNote: note.trim() }),
    onSuccess: (w) => {
      qc.setQueryData(["workflow", w.id], w);
      void qc.invalidateQueries({ queryKey: ["workflows"] });
      toast({ tone: "success", title: c.saved(w.currentVersion) });
    },
    onError: (e) => {
      if (!(isApiError(e) && e.code === "CONFLICT")) toast({ tone: "error", title: c.saveFailed, body: (e as Error).message });
    },
  });
  const conflict = save.isError && isApiError(save.error) && save.error.code === "CONFLICT";

  const patch = (i: number, p: Partial<WorkflowStepDef>) => setSteps((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((xs) => {
      const next = [...xs];
      const [item] = next.splice(i, 1);
      next.splice(i + dir, 0, item!);
      return next;
    });
  const add = () => {
    const tool = tools.data?.find((t) => t.id === (toolPick as ToolId)) ?? null;
    setSteps((xs) => [...xs, stepFromTool(toolPick === NO_TOOL ? null : tool, xs)]);
  };

  return (
    <Card>
      <SectionHead title={c.title} aside={wfCopy.versions.version(workflow.currentVersion)} />
      {!canWrite ? <Callout>{c.readOnly}</Callout> : null}
      {dirty ? <Callout tone="info">{c.unsaved}</Callout> : null}
      <ol className={s.editList}>
        {steps.map((st, i) => (
          <StepRow key={st.key} step={st} toolName={tools.data?.find((t) => t.id === st.tool)?.name ?? null} index={i} count={steps.length} readOnly={!canWrite} onChange={(p) => patch(i, p)} onMove={(d) => move(i, d)} onRemove={() => setSteps((xs) => xs.filter((_, j) => j !== i))} />
        ))}
      </ol>

      {canWrite ? (
        <div className={s.editAdd}>
          {tools.isPending ? (
            <Skeleton lines={1} height={38} />
          ) : tools.isError ? (
            <ErrorState compact error={tools.error} onRetry={() => void tools.refetch()} />
          ) : (
            <Select label={c.addTool} value={toolPick} onChange={(e) => setToolPick(e.target.value)} options={[{ value: NO_TOOL, label: c.noTool }, ...tools.data.map((t) => ({ value: t.id, label: `${t.name} · ${effectLabel(t.effect)}` }))]} />
          )}
          <Button icon={<Plus size={14} />} disabled={steps.length >= MAX_STEPS || tools.isPending} onClick={add}>
            {c.add}
          </Button>
          {steps.length >= MAX_STEPS ? <span className={s.muted}>{c.max}</span> : null}
        </div>
      ) : null}

      {canWrite ? (
        <div className={s.saveBar}>
          <TextField label={c.changeNote} hint={c.changeNoteHint} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <div aria-live="polite">
            {conflict ? (
              <Callout tone="warn">
                {c.conflict} {(save.error as Error).message}
                <div className={s.calloutActions}>
                  <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => void qc.invalidateQueries({ queryKey: ["workflow", workflow.id] })}>
                    {c.reload}
                  </Button>
                </div>
              </Callout>
            ) : null}
          </div>
          <div className={s.formFootRight}>
            <Button
              variant="ghost"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setSteps(structuredClone(workflow.current.steps));
                save.reset();
              }}
            >
              {c.reset}
            </Button>
            <Button variant="primary" icon={<Save size={14} />} disabled={!dirty || !valid} loading={save.isPending} onClick={() => save.mutate()}>
              {c.save}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
