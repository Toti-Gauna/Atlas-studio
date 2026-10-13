"use client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, CircleSlash, Clock, XCircle } from "lucide-react";
import type { RunDetail, RunStep } from "@atlas/contracts";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { formatDateTime, modelName, money, ms } from "@/lib/format";
import { Callout, DemoTag, DescList, ErrorState, LoadingBlock, ModeBadge, SectionHead, StatusBadge, TechDetails } from "@/components/ui";
import s from "./runs.module.css";

const STEP_ICON: Record<RunStep["status"], typeof CheckCircle2> = { succeeded: CheckCircle2, failed: XCircle, denied: CircleSlash, cancelled: CircleSlash, skipped: CircleDashed, pending: Clock, running: Clock };

export function costLabel(status: string, nano: string | null) {
  if (status === "no_provider_charge") return "Local · no provider charge";
  if (status === "unknown" || nano === null) return "Unknown (not zero)";
  return `${money(nano)}${status === "estimated" ? " (estimated)" : ""}`;
}

/** Kept for callers outside this folder; new code should use `<StatusBadge kind="run">`. */

/** Run trace (R11): frozen snapshot, operational steps and attempts — never private reasoning. */
export function RunTrace({ run }: { run: RunDetail }) {
  const snap = run.snapshot;
  const requestIds = run.attempts.map((a) => a.providerRequestId).filter(Boolean);
  return (
    <div className={s.trace}>
      <div className={s.badges}>
        <StatusBadge kind="run" status={run.status} />
        <ModeBadge mode={run.mode} />
        {run.label === "DEMO" ? <DemoTag /> : null}
      </div>
      <p className={s.objective}>{run.objective}</p>
      <Callout>{run.disclaimer}</Callout>
      <section>
        <SectionHead title="Configuration snapshot" />
        <DescList
          items={[
            ["Agent", `${run.agentName} · v${snap.agentVersion}`],
            ["Model", modelName(snap.modelKey)],
            ["Routing", `${snap.routing.source.replace(/_/g, " ")} — ${snap.routing.reason}`],
            ["Tools allowed", snap.agentConfig.allowedTools.join(", ")],
            ["Limits", `${snap.agentConfig.limits.maxSteps} steps · ${snap.agentConfig.limits.maxSeconds}s · ${snap.agentConfig.limits.maxOutputTokens.toLocaleString()} output tokens · ${money(snap.agentConfig.limits.maxCostNanoUsd)}`],
            ["Documents", snap.documentVersions.length ? snap.documentVersions.map((d) => `${d.title} v${d.version}`).join(", ") : "None"],
            ["Memory items", snap.memoryItemIds.length ? `${snap.memoryItemIds.length} approved item(s)` : "None"],
          ]}
        />
      </section>
      <section>
        <SectionHead title="Steps" aside={copy.disclaimers.reasoning} />
        <ol className={s.steps}>
          {run.steps.map((st) => {
            const Icon = STEP_ICON[st.status];
            return (
              <li key={st.id} className={s[`step_${st.status}`]}>
                <Icon size={16} aria-hidden />
                <div>
                  <div className={s.stepTitle}>
                    {st.title}
                    <span className="sr-only"> — {st.status}</span>
                  </div>
                  {st.summary ? <div className={s.stepSummary}>{st.summary}</div> : null}
                </div>
              </li>
            );
          })}
          {run.steps.length === 0 ? <li>No steps recorded.</li> : null}
        </ol>
      </section>
      <section>
        <SectionHead title="Attempts & cost" />
        <ul className={s.attempts}>
          {run.attempts.map((a) => (
            <li key={a.id}>
              Attempt {a.attemptNumber} · <StatusBadge kind="run" status={a.status} /> · {ms(a.latencyMs)}
            </li>
          ))}
          {run.attempts.length === 0 ? <li>No billable attempt (blocked before any call).</li> : null}
        </ul>
        <p className={s.cost}>Cost: {costLabel(run.costStatus, run.costNanoUsd)}</p>
        <p className={s.when}>
          Started {formatDateTime(run.startedAt)} · took {ms(run.latencyMs)}
        </p>
      </section>
      <TechDetails>
        <dl className={s.techList}>
          <dt>Configuration</dt>
          <dd className="mono">{snap.configHash}</dd>
          {snap.modelId ? (
            <>
              <dt>Model ID</dt>
              <dd className="mono">{snap.modelId}</dd>
            </>
          ) : null}
          <dt>Price version</dt>
          <dd className="mono">{snap.priceVersionId ?? "—"}</dd>
          <dt>Tools used</dt>
          <dd className="mono">{[...new Set(run.steps.map((st) => st.tool).filter(Boolean))].join(", ") || "—"}</dd>
          {run.attempts.some((a) => a.errorCode) ? (
            <>
              <dt>Error codes</dt>
              <dd className="mono">{run.attempts.map((a) => a.errorCode).filter(Boolean).join(", ")}</dd>
            </>
          ) : null}
          {requestIds.length ? (
            <>
              <dt>Provider requests</dt>
              <dd className="mono">{requestIds.join(", ")}</dd>
            </>
          ) : null}
          <dt>Run</dt>
          <dd className="mono">{run.id}</dd>
        </dl>
      </TechDetails>
    </div>
  );
}

export function RunPanel({ runId }: { runId: string }) {
  const q = useQuery({ queryKey: ["run", runId], queryFn: () => api.runs.get(runId) });
  return <div className={s.panel}>{q.isPending ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <RunTrace run={q.data} />}</div>;
}
