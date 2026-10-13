"use client";
import type { Budget, UsageReport } from "@atlas/contracts";
import { formatDate, money, tokens } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Card, Stat } from "@/components/ui";
import s from "./usage.module.css";

const sum = (days: UsageReport["daily"]) => days.reduce((acc, d) => acc + BigInt(d.calculatedNanoUsd), 0n);

/** Last 7 days vs the 7 before, from a 30-day daily series (calculated costs only). */
function weekChange(daily30: UsageReport["daily"] | undefined): { value: string; note: string } | null {
  if (!daily30 || daily30.length < 14) return null;
  const cur = sum(daily30.slice(-7));
  const prev = sum(daily30.slice(-14, -7));
  if (prev === 0n) return { value: money(cur), note: cur === 0n ? c.kpi.changeFlat : c.kpi.changeNone };
  const pct = Math.round(Number(((cur - prev) * 1000n) / prev) / 10);
  if (pct === 0) return { value: "0%", note: c.kpi.changeFlat };
  const label = `${Math.abs(pct)}%`;
  return { value: `${pct > 0 ? "+" : "−"}${label}`, note: pct > 0 ? c.kpi.changeUp(label) : c.kpi.changeDown(label) };
}

/** Three business answers: spend in the period, the trend, and what is left of the budget. */
export function UsageKpis({ report, daily30, workspaceBudget }: { report: UsageReport; daily30: UsageReport["daily"] | undefined; workspaceBudget: Budget | undefined }) {
  const t = report.totals;
  const change = weekChange(daily30);
  let remaining: { value: string; note: string } | null = null;
  if (workspaceBudget) {
    const left = BigInt(workspaceBudget.limitNanoUsd) - BigInt(workspaceBudget.spentNanoUsd) - BigInt(workspaceBudget.reservedNanoUsd);
    remaining = left >= 0n ? { value: money(left), note: c.kpi.remainingNote(money(workspaceBudget.limitNanoUsd)) } : { value: money(0n), note: c.kpi.remainingOver(money(-left)) };
  }
  return (
    <div className={s.kpiBlock}>
      <div className={s.kpis}>
        <Card>
          <Stat value={money(t.calculatedNanoUsd)} label={c.kpi.spend} note={c.kpi.spendNote(formatDate(report.from), formatDate(report.to))} />
        </Card>
        <Card>
          <Stat value={change?.value ?? "—"} label={c.kpi.change} note={change?.note} />
        </Card>
        <Card>
          <Stat value={remaining?.value ?? "—"} label={c.kpi.remaining} note={remaining?.note ?? c.kpi.noBudget} />
        </Card>
      </div>
      {t.unknownCostEntries ? <p className={s.warnNote}>{c.kpi.unknownNote(t.unknownCostEntries)}</p> : null}
    </div>
  );
}

/** Token totals: technical detail, collapsed by default on the page. */
export function TokenTotals({ totals }: { totals: UsageReport["totals"] }) {
  return (
    <Card>
      <h3 className={s.cardTitle}>{c.tokens.title}</h3>
      <dl className={s.tokenGrid}>
        <div>
          <dt>{c.tokens.input}</dt>
          <dd>{tokens(totals.inputTokens)}</dd>
        </div>
        <div>
          <dt>{c.tokens.output}</dt>
          <dd>{tokens(totals.outputTokens)}</dd>
          <span className={s.muted}>{c.tokens.outputNote}</span>
        </div>
        <div>
          <dt>{c.tokens.cacheRead}</dt>
          <dd>{tokens(totals.cacheReadTokens)}</dd>
        </div>
        <div>
          <dt>{c.tokens.cacheWrite}</dt>
          <dd>{tokens(totals.cacheWriteTokens)}</dd>
        </div>
        <div>
          <dt>{c.tokens.thinking}</dt>
          <dd>{tokens(totals.thinkingTokensReported)}</dd>
          <span className={s.muted}>{c.tokens.thinkingPart}</span>
        </div>
      </dl>
      <p className={s.mutedBlock}>{c.tokens.thinkingNote}</p>
      <p className={s.mutedBlock}>
        {c.tokens.attempts(totals.attempts, totals.failedOrCancelled)}
        {c.tokens.localEntries(totals.localEntries)}
      </p>
    </Card>
  );
}
