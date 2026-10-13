"use client";
import type { ReactNode } from "react";
import { ShieldAlert, Sparkles, UserCheck } from "lucide-react";
import type { PlanPreview as Plan } from "@atlas/contracts";
import { modelName, money, tokens } from "@/lib/format";
import { Badge, Callout, TechDetails } from "@/components/ui";
import { planCopy as c } from "@/copy/workflows";
import s from "./plan.module.css";

const CONFIRM = new Set(["requires_confirmation", "waits_for_your_confirmation"]);
const norm = (effect: string) => effect.trim().toLowerCase().replace(/[\s-]+/g, "_");

/** Step effect in words. Known server values map to copy; plain sentences pass through. */
export function effectLabel(effect: string): string {
  const known = c.effect[norm(effect)];
  if (known) return known;
  const text = effect.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : c.effect.none!;
}

/**
 * The one plan preview used by agents and workflows: steps with their effect
 * in words, model routing, cost estimate, confirmations and missing brief.
 * Tool ids and token estimates stay behind "Technical details".
 */
export function PlanPreview({ plan, footer }: { plan: Plan; footer?: ReactNode }) {
  const r = plan.routing;
  const local = r.modelKey.startsWith("local:");
  const est = plan.estimate;
  return (
    <div className={s.plan}>
      <section aria-label={c.steps}>
        <h3 className={s.head}>{c.steps}</h3>
        <ol className={s.steps}>
          {plan.steps.map((st, i) => {
            const confirm = CONFIRM.has(norm(st.effect));
            return (
              <li key={`${i}-${st.title}`}>
                <span className={s.idx} aria-hidden>
                  {i + 1}
                </span>
                <div className={s.body}>
                  <div className={s.title}>{st.title}</div>
                  <div className={s.meta}>
                    {confirm ? (
                      <Badge tone="warn" icon={<UserCheck size={12} aria-hidden />}>
                        {c.needsConfirmation}
                      </Badge>
                    ) : (
                      <span>{effectLabel(st.effect)}</span>
                    )}
                    {st.invokesModel ? (
                      <Badge tone="info" icon={<Sparkles size={12} aria-hidden />}>
                        {c.callsModel}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={c.routing}>
        <h3 className={s.head}>{c.routing}</h3>
        <p className={s.line}>
          {modelName(r.modelKey)} <span className={s.muted}>· {c.source[r.source]}</span>
        </p>
        {r.reason ? <p className={s.muted}>{r.reason}</p> : null}
        {r.pendingFallback ? (
          <Callout tone="info">
            {c.pendingFallback(modelName(r.pendingFallback.modelKey))} {r.pendingFallback.reason}
            {r.pendingFallback.changesProvider || r.pendingFallback.changesPrice ? (
              <span className={s.chips}>
                {r.pendingFallback.changesProvider ? <Badge tone="warn">{c.changesProvider}</Badge> : null}
                {r.pendingFallback.changesPrice ? <Badge tone="warn">{c.changesPrice}</Badge> : null}
              </span>
            ) : null}
          </Callout>
        ) : null}
        {r.blocked ? (
          <Callout tone="danger">
            <strong>{c.blocked}.</strong> {r.blocked.message}
          </Callout>
        ) : null}
      </section>

      <section aria-label={c.estimate}>
        <h3 className={s.head}>{c.estimate}</h3>
        <p className={s.line}>{local ? c.noCharge : est.costNanoUsd === null ? c.unknownCost : `${c.upperBound} ${money(est.costNanoUsd)}`}</p>
        {est.basis && !local ? <p className={s.muted}>{est.basis}</p> : null}
      </section>

      {plan.confirmationReasons.length ? (
        <Callout tone="warn" icon={<ShieldAlert size={16} aria-hidden />}>
          <strong>{c.confirmations}</strong>
          <ul className={s.list}>
            {plan.confirmationReasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {plan.missingBrief.length ? (
        <Callout tone="warn">
          <strong>{c.missingBrief}</strong>
          <ul className={s.list}>
            {plan.missingBrief.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <TechDetails>
        <ul className={s.techList}>
          {plan.steps.map((st, i) => (
            <li key={`t-${i}`}>
              Step {i + 1}: tool <span className="mono">{st.tool ?? "none"}</span> · effect <span className="mono">{st.effect}</span>
            </li>
          ))}
          <li>
            Routing source <span className="mono">{r.source}</span> · model key <span className="mono">{r.modelKey}</span>
            {r.blocked ? (
              <>
                {" "}· block code <span className="mono">{r.blocked.code}</span>
              </>
            ) : null}
          </li>
          <li>
            Token estimate: {tokens(est.inputTokens)} in · {tokens(est.outputTokens)} out · agent version {plan.agentVersion}
          </li>
        </ul>
      </TechDetails>
      {footer}
    </div>
  );
}
