"use client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, CircleSlash, Clock, XCircle } from "lucide-react";
import type { RunDetail, RunStep } from "@atlas/contracts";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { formatDateTime, modelName, money, ms } from "@/lib/format";
import { Badge, Callout, DemoTag, DescList, ErrorState, LoadingBlock, SectionHead } from "@/components/ui";
import s from "./runs.module.css";

const STEP_ICON: Record<RunStep["status"], typeof CheckCircle2> = { succeeded: CheckCircle2, failed: XCircle, denied: CircleSlash, cancelled: CircleSlash, skipped: CircleDashed, pending: Clock, running: Clock };

export function costLabel(status: string, nano: string | null) {
  if (status === "no_provider_charge") return "Local · no provider charge";
  if (status === "unknown" || nano === null) return "Unknown (not zero)";
  return `${money(nano)}${status === "estimated" ? " (estimated)" : ""}`;
}

export const RUN_TONE = { succeeded: "teal", abstained: "info", failed: "danger", cancelled: "warn", blocked: "warn", running: "info", planned: "neutral", awaiting_confirmation: "violet" } as const;

/** Run trace (R11): frozen snapshot, operational steps and attempts — never private reasoning. */
export function RunTrace({ run }: { run: RunDetail }) {
  const snap = run.snapshot;
  return (
    <div className={s.trace}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Badge tone={RUN_TONE[run.status]}>{run.status.replace("_", " ")}</Badge>
        <Badge tone={run.mode === "local" ? "teal" : "info"}>{run.mode === "local" ? "Local" : "Connected"}</Badge>
        {run.label === "DEMO" ? <DemoTag /> : null}
      </div>
      <p className={s.objective}>{run.objective}</p>
      <Callout>{run.disclaimer}</Callout>
      <section>
        <SectionHead title="Configuration snapshot" aside={<span className="mono">{snap.configHash}</span>} />
        <DescList
          items={[
            ["Agent", `${run.agentName} · v${snap.agentVersion}`],
            ["Model", `${modelName(snap.modelKey)}${snap.modelId ? ` (${snap.modelId})` : ""}`],
            ["Routing", `${snap.routing.source.replace(/_/g, " ")} — ${snap.routing.reason}`],
            ["Price version", snap.priceVersionId ?? "—"],
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
                    {st.title} {st.tool ? <span className="mono" style={{ color: "var(--text-3)", fontSize: 11 }}>{st.tool}</span> : null}
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
              <span className="mono">#{a.attemptNumber}</span> {a.status} · {ms(a.latencyMs)}
              {a.providerRequestId ? <span className="mono"> · {a.providerRequestId}</span> : null}
              {a.errorCode ? <Badge tone="warn">{a.errorCode}</Badge> : null}
            </li>
          ))}
          {run.attempts.length === 0 ? <li>No billable attempt (blocked before any call).</li> : null}
        </ul>
        <p style={{ marginTop: 8, fontWeight: 600 }}>Cost: {costLabel(run.costStatus, run.costNanoUsd)}</p>
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>Started {formatDateTime(run.startedAt)} · latency {ms(run.latencyMs)}</p>
      </section>
    </div>
  );
}

export function RunPanel({ runId }: { runId: string }) {
  const q = useQuery({ queryKey: ["run", runId], queryFn: () => api.runs.get(runId) });
  return <div style={{ padding: 16 }}>{q.isPending ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <RunTrace run={q.data} />}</div>;
}
