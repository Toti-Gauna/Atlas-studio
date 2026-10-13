"use client";
import type { ReactNode } from "react";
import type { UsageGroup, UsageGroupBy } from "@atlas/contracts";
import { modelName, money, ms, tokens } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Badge, Table, numCell } from "@/components/ui";
import s from "./usage.module.css";

function groupLabel(g: UsageGroup, by: UsageGroupBy) {
  if (by === "model") return modelName(g.key);
  if (by === "provider") return c.providers[g.key] ?? g.label;
  return g.label;
}

/** Cost per group (what people ask), or tokens per group (technical detail). */
export function GroupsTable({ groups, groupBy, variant = "cost" }: { groups: UsageGroup[]; groupBy: UsageGroupBy; variant?: "cost" | "tokens" }) {
  const g0 = c.groups;
  const head = (label: string, num = true): ReactNode => (
    <th scope="col" className={num ? numCell : undefined}>
      {label}
    </th>
  );
  const name = (g: UsageGroup) => (
    <th scope="row" className={s.groupName}>
      {groupLabel(g, groupBy)}
      {variant === "cost" && g.localEntries > 0 && g.localEntries === g.attempts ? (
        <>
          {" "}
          <Badge tone="teal">{c.kpi.local}</Badge>
        </>
      ) : null}
    </th>
  );
  return (
    <Table stack caption={`${variant === "cost" ? g0.caption : g0.tokensTitle}: ${c.groupBy[groupBy]}`}>
      <thead>
        {variant === "cost" ? (
          <tr>
            {head(c.groupBy[groupBy], false)}
            {head(g0.cost)}
            {head(g0.unknown)}
            {head(g0.runs)}
            {head(g0.failed)}
          </tr>
        ) : (
          <tr>
            {head(c.groupBy[groupBy], false)}
            {head(g0.attempts)}
            {head(g0.input)}
            {head(g0.output)}
            {head(g0.cacheRead)}
            {head(g0.cacheWrite)}
            {head(g0.thinking)}
            {head(g0.p50)}
          </tr>
        )}
      </thead>
      <tbody>
        {groups.map((g) =>
          variant === "cost" ? (
            <tr key={g.key}>
              {name(g)}
              <td className={numCell} data-label={g0.cost}>{money(g.calculatedNanoUsd)}</td>
              <td className={numCell} data-label={g0.unknown}>{g.unknownCostEntries ? <Badge tone="warn">{g.unknownCostEntries}</Badge> : "0"}</td>
              <td className={numCell} data-label={g0.runs}>{g.runs}</td>
              <td className={numCell} data-label={g0.failed}>{g.failedOrCancelled}</td>
            </tr>
          ) : (
            <tr key={g.key}>
              {name(g)}
              <td className={numCell} data-label={g0.attempts}>{g.attempts}</td>
              <td className={numCell} data-label={g0.input}>{tokens(g.inputTokens)}</td>
              <td className={numCell} data-label={g0.output}>{tokens(g.outputTokens)}</td>
              <td className={numCell} data-label={g0.cacheRead}>{tokens(g.cacheReadTokens)}</td>
              <td className={numCell} data-label={g0.cacheWrite}>{tokens(g.cacheWriteTokens)}</td>
              <td className={numCell} data-label={g0.thinking} title={c.tokens.thinkingNote}>{tokens(g.thinkingTokensReported)}</td>
              <td className={numCell} data-label={g0.p50}>{ms(g.p50LatencyMs)}</td>
            </tr>
          ),
        )}
      </tbody>
    </Table>
  );
}
