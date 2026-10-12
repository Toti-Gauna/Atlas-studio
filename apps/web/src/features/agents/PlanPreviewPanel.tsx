"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import type { PlanPreview } from "@atlas/contracts";
import { api } from "@/lib/api";
import { modelName, money, tokens } from "@/lib/format";
import { Badge, Button, Callout, Card, DescList, ErrorState, Select, Skeleton, TextArea } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import s from "./agents.module.css";
import ps from "./panels.module.css";

function PlanResult({ plan }: { plan: PlanPreview }) {
  const r = plan.routing;
  const local = r.modelKey.startsWith("local:");
  return (
    <div className={ps.planResult}>
      <section aria-labelledby="plan-steps-h">
        <h3 id="plan-steps-h" className={ps.planHead}>
          {c.plan.steps}
        </h3>
        <ol className={ps.planSteps}>
          {plan.steps.map((st, i) => (
            <li key={i}>
              <span className={s.checkTitle}>{st.title}</span>
              <span className={s.badges}>
                {st.tool ? <Badge mono>{st.tool}</Badge> : null}
                <Badge tone={st.effect.includes("confirmation") ? "warn" : "neutral"}>{st.effect}</Badge>
                {st.invokesModel ? <Badge tone="info">{c.plan.invokesModel}</Badge> : <Badge tone="teal">{c.plan.noModel}</Badge>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="plan-routing-h">
        <h3 id="plan-routing-h" className={ps.planHead}>
          {c.plan.routing}
        </h3>
        <DescList
          items={[
            ["Model", modelName(r.modelKey)],
            ["Source", c.plan.source[r.source]],
            ["Reason", r.reason],
          ]}
        />
        {r.pendingFallback ? (
          <Callout tone="warn">
            {c.plan.pendingFallback(modelName(r.pendingFallback.modelKey))} {r.pendingFallback.reason}
            <span className={s.badges} style={{ marginTop: 6 }}>
              {r.pendingFallback.changesProvider ? <Badge tone="warn">{c.plan.changesProvider}</Badge> : null}
              {r.pendingFallback.changesPrice ? <Badge tone="warn">{c.plan.changesPrice}</Badge> : null}
            </span>
          </Callout>
        ) : null}
        {r.blocked ? (
          <Callout tone="danger">
            <strong>{r.blocked.code}</strong> — {r.blocked.message}
          </Callout>
        ) : null}
      </section>

      <section aria-labelledby="plan-est-h">
        <h3 id="plan-est-h" className={ps.planHead}>
          {c.plan.estimate}
        </h3>
        {local ? (
          <p className={s.hint}>{c.plan.noCharge}</p>
        ) : (
          <DescList
            items={[
              [c.plan.upperBound, plan.estimate.costNanoUsd === null ? c.plan.unknownCost : money(plan.estimate.costNanoUsd)],
              [c.plan.tokensIn, tokens(plan.estimate.inputTokens)],
              [c.plan.tokensOut, tokens(plan.estimate.outputTokens)],
            ]}
          />
        )}
        <p className={s.hint}>{plan.estimate.basis}</p>
      </section>

      {plan.confirmationReasons.length ? (
        <section aria-labelledby="plan-conf-h">
          <h3 id="plan-conf-h" className={ps.planHead}>
            {c.plan.confirmations}
          </h3>
          <ul className={ps.bullets}>
            {plan.confirmationReasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.missingBrief.length ? (
        <section aria-labelledby="plan-brief-h">
          <h3 id="plan-brief-h" className={ps.planHead}>
            {c.plan.missingBrief}
          </h3>
          <ul className={ps.bullets}>
            {plan.missingBrief.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function PlanPreviewPanel({ agentId, version }: { agentId: string | null; version: number | null }) {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const [objective, setObjective] = useState("");
  const [projectId, setProjectId] = useState("");
  const pid = projectId || projects.data?.[0]?.id || "";
  const plan = useMutation({ mutationFn: () => api.agents.plan(agentId!, { objective: objective.trim(), projectId: pid, pinnedModelKey: null }) });

  return (
    <Card className={ps.planCard} aria-labelledby="plan-h">
      <h2 id="plan-h" className={s.sectionTitle}>
        <Eye size={16} aria-hidden /> {c.plan.title}
      </h2>
      <p className={s.hint}>{c.plan.intro}</p>
      {!agentId || version === null ? (
        <Callout>{c.plan.saveFirst}</Callout>
      ) : (
        <form
          className={s.fields}
          onSubmit={(e) => {
            e.preventDefault();
            if (objective.trim() && pid) plan.mutate();
          }}
        >
          <p className={s.hint}>{c.plan.savedOnly(version)}</p>
          <TextArea label={c.plan.objective} rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={2000} />
          {projects.isPending ? (
            <Skeleton lines={1} />
          ) : projects.isError ? (
            <ErrorState error={projects.error} compact onRetry={() => void projects.refetch()} />
          ) : projects.data.length === 0 ? (
            <p className={s.hint}>{c.plan.noProjects}</p>
          ) : (
            <Select label={c.plan.project} value={pid} options={projects.data.map((p) => ({ value: p.id, label: p.name }))} onChange={(e) => setProjectId(e.target.value)} />
          )}
          <div>
            <Button type="submit" variant="primary" loading={plan.isPending} disabled={!objective.trim() || !pid}>
              {c.plan.preview}
            </Button>
          </div>
        </form>
      )}
      <div aria-live="polite">
        {plan.isError ? <ErrorState error={plan.error} compact onRetry={() => plan.mutate()} /> : null}
        {plan.data && !plan.isPending ? <PlanResult plan={plan.data} /> : null}
      </div>
    </Card>
  );
}
