"use client";
import { Cpu, Play, ShieldAlert, Sparkles } from "lucide-react";
import type { PlanPreview } from "@atlas/contracts";
import { modelName, money } from "@/lib/format";
import { Badge, Button, Callout, Card, DescList, SectionHead } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import s from "./workflows.module.css";

/** The Run button lives here so no model is invoked before the plan has been seen. */
export function PlanPreviewCard({ plan, version, canRun, running, onRun, onDiscard }: { plan: PlanPreview; version: number; canRun: boolean; running: boolean; onRun: () => void; onDiscard: () => void }) {
  const c = wfCopy.preview;
  const r = plan.routing;
  const blocked = Boolean(r.blocked);
  return (
    <Card className={s.previewCard}>
      <SectionHead title={c.title(version)} aside={c.aside} />
      <ol className={s.planSteps}>
        {plan.steps.map((st, i) => (
          <li key={`${i}-${st.title}`}>
            <span className={s.planIdx} aria-hidden>
              {i + 1}
            </span>
            <div className={s.planBody}>
              <div className={s.planTitle}>{st.title}</div>
              <div className={s.planMeta}>
                {st.tool ? (
                  <Badge mono tone="neutral">
                    {st.tool}
                  </Badge>
                ) : null}
                {st.invokesModel ? (
                  <Badge tone="info" icon={<Sparkles size={12} aria-hidden />}>
                    {c.model}
                  </Badge>
                ) : (
                  <Badge tone="teal" icon={<Cpu size={12} aria-hidden />}>
                    {c.noModel}
                  </Badge>
                )}
                <span className={s.muted}>{st.effect}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <DescList
        items={[
          [c.routing, <span key="r">{modelName(r.modelKey)} · {r.source.replace(/_/g, " ")} — {r.reason}</span>],
          [c.estimate, <span key="e">{c.tokens(plan.estimate.inputTokens, plan.estimate.outputTokens)} · {plan.estimate.costNanoUsd === null ? "Unknown (not zero)" : money(plan.estimate.costNanoUsd)} — {plan.estimate.basis}</span>],
        ]}
      />
      {r.pendingFallback ? <Callout tone="info">{c.fallback(modelName(r.pendingFallback.modelKey), r.pendingFallback.reason)}</Callout> : null}
      {r.blocked ? (
        <Callout tone="danger">
          <strong>{c.blocked}.</strong> {r.blocked.message}
        </Callout>
      ) : null}
      {plan.confirmationReasons.length ? (
        <Callout tone="warn" icon={<ShieldAlert size={16} aria-hidden />}>
          <strong>{c.confirmations}</strong>
          <ul className={s.plainList}>
            {plan.confirmationReasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {plan.missingBrief.length ? (
        <Callout tone="warn">
          <strong>{c.missing}</strong>
          <ul className={s.plainList}>
            {plan.missingBrief.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <div className={s.previewFoot}>
        <span className={s.muted}>{canRun ? c.runHint : c.noRunRole}</span>
        <div className={s.formFootRight}>
          <Button variant="ghost" onClick={onDiscard}>
            {c.discard}
          </Button>
          <Button variant="primary" icon={<Play size={14} />} disabled={!canRun || blocked} loading={running} onClick={onRun}>
            {c.run}
          </Button>
        </div>
      </div>
    </Card>
  );
}
