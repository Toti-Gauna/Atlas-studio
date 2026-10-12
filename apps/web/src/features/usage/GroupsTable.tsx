"use client";
import type { UsageGroup, UsageGroupBy } from "@atlas/contracts";
import { modelName, money, ms, tokens } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Badge, SectionHead, Table, numCell } from "@/components/ui";

function groupLabel(g: UsageGroup, by: UsageGroupBy) {
  if (by === "model") return modelName(g.key);
  if (by === "provider") return c.providers[g.key] ?? g.label;
  return g.label;
}

export function GroupsTable({ groups, groupBy }: { groups: UsageGroup[]; groupBy: UsageGroupBy }) {
  return (
    <section aria-labelledby="usage-groups-h">
      <SectionHead id="usage-groups-h" title={`${c.groups.title} · ${c.groupBy[groupBy]}`} />
      <Table caption={`${c.groups.caption}: ${c.groupBy[groupBy]}`}>
        <thead>
          <tr>
            <th scope="col">{c.groups.key}</th>
            <th scope="col" className={numCell}>{c.groups.runs}</th>
            <th scope="col" className={numCell}>{c.groups.attempts}</th>
            <th scope="col" className={numCell}>{c.groups.failed}</th>
            <th scope="col" className={numCell}>{c.groups.input}</th>
            <th scope="col" className={numCell}>{c.groups.output}</th>
            <th scope="col" className={numCell}>{c.groups.cacheRead}</th>
            <th scope="col" className={numCell}>{c.groups.cacheWrite}</th>
            <th scope="col" className={numCell}>{c.groups.thinking}</th>
            <th scope="col" className={numCell}>{c.groups.cost}</th>
            <th scope="col" className={numCell}>{c.groups.unknown}</th>
            <th scope="col" className={numCell}>{c.groups.p50}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key}>
              <th scope="row" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {groupLabel(g, groupBy)}
                {g.localEntries > 0 && g.localEntries === g.attempts ? (
                  <>
                    {" "}
                    <Badge tone="teal">{c.kpi.local}</Badge>
                  </>
                ) : null}
              </th>
              <td className={numCell}>{g.runs}</td>
              <td className={numCell}>{g.attempts}</td>
              <td className={numCell}>{g.failedOrCancelled}</td>
              <td className={numCell}>{tokens(g.inputTokens)}</td>
              <td className={numCell}>{tokens(g.outputTokens)}</td>
              <td className={numCell}>{tokens(g.cacheReadTokens)}</td>
              <td className={numCell}>{tokens(g.cacheWriteTokens)}</td>
              <td className={numCell} title={c.tokens.thinkingNote}>{tokens(g.thinkingTokensReported)}</td>
              <td className={numCell}>{money(g.calculatedNanoUsd)}</td>
              <td className={numCell}>{g.unknownCostEntries ? <Badge tone="warn">{g.unknownCostEntries}</Badge> : 0}</td>
              <td className={numCell}>{ms(g.p50LatencyMs)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
