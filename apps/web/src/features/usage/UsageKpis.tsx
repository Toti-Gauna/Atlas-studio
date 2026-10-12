"use client";
import type { UsageReport } from "@atlas/contracts";
import { money, tokens } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Card, Stat } from "@/components/ui";
import s from "./usage.module.css";

export function UsageKpis({ totals }: { totals: UsageReport["totals"] }) {
  return (
    <>
      <div className={s.kpis}>
        <Card>
          <Stat value={money(totals.calculatedNanoUsd)} label={c.kpi.cost} note={c.kpi.costNote} />
        </Card>
        <Card>
          <Stat value={totals.unknownCostEntries.toLocaleString("en-US")} label={c.kpi.unknown} note={c.kpi.unknownNote} />
        </Card>
        <Card>
          <Stat value={totals.localEntries.toLocaleString("en-US")} label={c.kpi.local} note={c.kpi.localNote} />
        </Card>
        <Card>
          <Stat value={totals.attempts.toLocaleString("en-US")} label={c.kpi.attempts} note={c.kpi.attemptsNote(totals.failedOrCancelled)} />
        </Card>
      </div>
      <Card>
        <h2 className={s.cardTitle}>{c.tokens.title}</h2>
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
            <span className={s.muted}>part of output</span>
          </div>
        </dl>
        <p className={s.muted} style={{ marginTop: 12 }}>{c.tokens.thinkingNote}</p>
      </Card>
    </>
  );
}
