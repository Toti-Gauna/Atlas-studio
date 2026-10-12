"use client";
import { useRef } from "react";
import { CheckCircle2, Circle, CircleDashed, CircleDot, CircleSlash, FileText, ListTree, UserCheck, XCircle } from "lucide-react";
import type { WorkflowCheckpoint, WorkflowRun, WorkflowStepDef } from "@atlas/contracts";
import { gsap, MOTION, useGSAP, useReducedMotion } from "@/lib/motion";
import { usePanel } from "@/lib/state/panel";
import { Badge, Button, LinkButton } from "@/components/ui";
import { CHECKPOINT_LABEL, wfCopy } from "@/copy/workflows";
import s from "./workflows.module.css";

const ICON: Record<WorkflowCheckpoint["status"], typeof Circle> = {
  pending: Circle,
  running: CircleDot,
  succeeded: CheckCircle2,
  failed: XCircle,
  awaiting_confirmation: UserCheck,
  skipped: CircleDashed,
  cancelled: CircleSlash,
};

/** Vertical stepper of server checkpoints. The highlight follows currentStepKey from the server, not a timer. */
export function CheckpointList({ run, steps }: { run: WorkflowRun; steps: WorkflowStepDef[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { open } = usePanel();
  const c = wfCopy.run;
  const active = run.status === "succeeded" ? null : run.currentStepKey;

  useGSAP(
    () => {
      if (reduced || !active || !ref.current) return;
      const el = ref.current.querySelector<HTMLElement>(`[data-step="${CSS.escape(active)}"]`);
      if (!el) return;
      gsap.fromTo(el, { opacity: 0.55, x: -6 }, { opacity: 1, x: 0, duration: MOTION.step, ease: MOTION.ease, clearProps: "transform,opacity" });
    },
    { dependencies: [active, reduced], scope: ref },
  );

  return (
    <ol className={s.stepper} ref={ref} aria-label="Checkpoints">
      {run.checkpoints.map((cp, i) => {
        const def = steps.find((st) => st.key === cp.stepKey);
        const Icon = ICON[cp.status];
        const isCurrent = cp.stepKey === active;
        return (
          <li key={cp.stepKey} data-step={cp.stepKey} className={`${s.cp} ${s[`cp_${cp.status}`] ?? ""} ${isCurrent ? s.cpCurrent : ""}`} aria-current={isCurrent ? "step" : undefined}>
            <span className={s.cpIcon}>
              <Icon size={18} aria-hidden strokeWidth={2} />
            </span>
            <div className={s.cpBody}>
              <div className={s.cpHead}>
                <span className={s.cpTitle}>
                  <span className="sr-only">Step {i + 1}: </span>
                  {def?.title ?? cp.stepKey}
                </span>
                <Badge tone={cp.status === "succeeded" ? "teal" : cp.status === "failed" ? "danger" : cp.status === "awaiting_confirmation" ? "warn" : cp.status === "running" ? "info" : "neutral"}>{CHECKPOINT_LABEL[cp.status]}</Badge>
                {def?.tool ? <span className={`mono ${s.cpTool}`}>{def.tool}</span> : null}
              </div>
              {cp.outputSummary ? <p className={s.cpSummary}>{cp.outputSummary}</p> : null}
              <div className={s.cpMeta}>
                <span className="tabular">{c.attempt(cp.attempt)}</span>
                <span className={s.cpKey} title={c.idem}>
                  <span className="sr-only">{c.idem}: </span>
                  <span className="mono">{cp.idempotencyKey}</span>
                </span>
              </div>
              {cp.artifactId || cp.runId ? (
                <div className={s.cpActions}>
                  {cp.artifactId ? (
                    <LinkButton size="sm" href={`/app/artifact/?id=${cp.artifactId}`} icon={<FileText size={14} aria-hidden />}>
                      {c.openArtifact}
                    </LinkButton>
                  ) : null}
                  {cp.runId ? (
                    <Button size="sm" variant="ghost" icon={<ListTree size={14} />} onClick={() => open({ kind: "run", runId: cp.runId! })}>
                      {c.trace}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
