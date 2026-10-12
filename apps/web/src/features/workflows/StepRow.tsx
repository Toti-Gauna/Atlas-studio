"use client";
import { ArrowDown, ArrowUp, Cpu, Sparkles, Trash2 } from "lucide-react";
import type { WorkflowStepDef } from "@atlas/contracts";
import { Badge, IconButton, Switch, TextField } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import s from "./workflows.module.css";

export function StepRow({
  step,
  index,
  count,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: {
  step: WorkflowStepDef;
  index: number;
  count: number;
  readOnly: boolean;
  onChange: (patch: Partial<WorkflowStepDef>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const c = wfCopy.editor;
  const n = index + 1;
  const titleErr = !step.title.trim() || step.title.length > 120 ? c.titleRequired : null;
  const hintErr = step.inputHint.length > 300 ? c.hintTooLong : null;
  return (
    <li className={s.editRow}>
      <div className={s.editHead}>
        <span className={s.planIdx} aria-hidden>
          {n}
        </span>
        <div className={s.planMeta}>
          <Badge mono tone="neutral">
            {step.tool ?? "manual"}
          </Badge>
          {step.invokesModel ? (
            <Badge tone="info" icon={<Sparkles size={12} aria-hidden />}>
              {wfCopy.preview.model}
            </Badge>
          ) : (
            <Badge tone="teal" icon={<Cpu size={12} aria-hidden />}>
              {wfCopy.preview.noModel}
            </Badge>
          )}
          <span className={s.muted}>{c.effect[step.effect]}</span>
          <span className={`mono ${s.cpTool}`}>{step.key}</span>
        </div>
        {!readOnly ? (
          <div className={s.editTools}>
            <IconButton size="sm" label={c.moveUp(n)} disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp size={15} />
            </IconButton>
            <IconButton size="sm" label={c.moveDown(n)} disabled={index === count - 1} onClick={() => onMove(1)}>
              <ArrowDown size={15} />
            </IconButton>
            <IconButton size="sm" label={c.remove(n)} disabled={count <= 1} onClick={onRemove}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        ) : null}
      </div>
      <div className={s.editFields}>
        <TextField label={`${c.stepTitle} (step ${n})`} value={step.title} maxLength={120} readOnly={readOnly} error={titleErr} onChange={(e) => onChange({ title: e.target.value })} />
        <TextField label={`${c.inputHint} (step ${n})`} value={step.inputHint} maxLength={300} readOnly={readOnly} error={hintErr} onChange={(e) => onChange({ inputHint: e.target.value })} />
      </div>
      <Switch label={c.confirmStep(n)} description={c.confirmDesc} checked={step.requiresConfirmation} disabled={readOnly} onChange={(v) => onChange({ requiresConfirmation: v })} />
    </li>
  );
}
