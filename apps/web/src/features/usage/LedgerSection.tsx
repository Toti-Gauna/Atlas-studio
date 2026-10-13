"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LedgerEntry } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, modelName, money, ms, tokens } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Badge, EmptyState, IconButton, QueryState, SectionHead, StatusBadge, Table, numCell } from "@/components/ui";
import s from "./usage.module.css";

function costCell(e: LedgerEntry) {
  if (e.costStatus === "no_provider_charge") return c.ledger.costLocal;
  if (e.costStatus === "unknown" || e.costNanoUsd === null) return c.ledger.costUnknown;
  return money(e.costNanoUsd);
}

function Breakdown({ entry }: { entry: LedgerEntry }) {
  if (!entry.breakdown.length) return <p className={s.muted}>{c.ledger.noBreakdown}</p>;
  return (
    <table className={s.subTable}>
      <caption className="sr-only">{c.ledger.breakdownCaption(entry.attemptNumber)}</caption>
      <thead>
        <tr>
          <th scope="col">{c.ledger.category}</th>
          <th scope="col" className={numCell}>{c.ledger.quantity}</th>
          <th scope="col" className={numCell}>{c.ledger.unitPrice}</th>
          <th scope="col" className={numCell}>{c.ledger.lineCost}</th>
          <th scope="col">{c.ledger.note}</th>
        </tr>
      </thead>
      <tbody>
        {entry.breakdown.map((b, i) => (
          <tr key={i}>
            <td>{c.categories[b.category] ?? b.category}</td>
            <td className={numCell}>{tokens(b.quantity)}</td>
            <td className={numCell}>{b.unitPriceUsdPerMTok === null ? c.ledger.unitUnknown : `$${b.unitPriceUsdPerMTok}`}</td>
            <td className={numCell}>{b.nanoUsd === null ? c.ledger.costUnknown : money(b.nanoUsd)}</td>
            <td>{b.note ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Per-attempt ledger: failed and cancelled attempts are listed because they can still consume. */
export function LedgerSection({ range, modelKey }: { range: "7d" | "30d"; modelKey?: string }) {
  const q = useQuery({ queryKey: ["usage-ledger", range, modelKey ?? null], queryFn: () => api.usage.ledger({ range, modelKey }) });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section aria-labelledby="ledger-h">
      <SectionHead id="ledger-h" title={c.ledger.title} aside={c.filters.modelOnly} />
      {q.data?.items.length === 100 ? <p className={s.muted}>{c.ledger.truncated(100)}</p> : null}
      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title={c.ledger.empty} />}>
        {(page) => (
          <Table stack caption={c.ledger.caption}>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{c.ledger.breakdown}</span></th>
                <th scope="col">{c.ledger.time}</th>
                <th scope="col">{c.ledger.run}</th>
                <th scope="col" className={numCell}>{c.ledger.attempt}</th>
                <th scope="col">{c.ledger.requestId}</th>
                <th scope="col">{c.ledger.model}</th>
                <th scope="col">{c.ledger.status}</th>
                <th scope="col" className={numCell}>{c.ledger.usage}</th>
                <th scope="col">{c.ledger.costStatus}</th>
                <th scope="col" className={numCell}>{c.ledger.cost}</th>
                <th scope="col" className={numCell}>{c.ledger.latency}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((e) => {
                const expanded = open.has(e.id);
                const u = e.usage;
                return (
                  <Fragment key={e.id}>
                    <tr>
                      <td data-label={c.ledger.breakdown}>
                        <IconButton size="sm" label={expanded ? c.ledger.hideBreakdown(e.attemptNumber) : c.ledger.showBreakdown(e.attemptNumber)} aria-expanded={expanded} aria-controls={expanded ? `bd-${e.id}` : undefined} onClick={() => toggle(e.id)}>
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </IconButton>
                      </td>
                      <td className={s.nowrap} data-label={c.ledger.time}>{formatDateTime(e.occurredAt)}</td>
                      <td data-label={c.ledger.run}>
                        <Link href={`/app/runs/?id=${e.runId}`} className={s.monoSmall}>
                          {e.runId}
                        </Link>
                      </td>
                      <td className={numCell} data-label={c.ledger.attempt}>#{e.attemptNumber}</td>
                      <td className={s.monoSmall} data-label={c.ledger.requestId}>{e.providerRequestId ?? "—"}</td>
                      <td className={s.nowrap} data-label={c.ledger.model}>{modelName(e.modelKey)}</td>
                      <td data-label={c.ledger.status}><StatusBadge kind="run" status={e.status} /></td>
                      <td className={numCell} data-label={c.ledger.usage}>
                        {tokens(u.inputUncachedTokens)} / {tokens(u.outputTokens)} / {tokens(u.cacheReadTokens)} / {u.cacheWrite5mTokens === null && u.cacheWrite1hTokens === null ? "—" : tokens((u.cacheWrite5mTokens ?? 0) + (u.cacheWrite1hTokens ?? 0))}
                        {u.thinkingTokensReported ? <div className={s.muted}>{c.ledger.thinking(tokens(u.thinkingTokensReported))}</div> : null}
                      </td>
                      <td data-label={c.ledger.costStatus}>{e.costStatus === "unknown" ? <Badge tone="warn">{c.costStatus.unknown}</Badge> : c.costStatus[e.costStatus]}</td>
                      <td className={numCell} data-label={c.ledger.cost}>{costCell(e)}</td>
                      <td className={numCell} data-label={c.ledger.latency}>{ms(e.latencyMs)}</td>
                    </tr>
                    {expanded ? (
                      <tr id={`bd-${e.id}`}>
                        <td colSpan={11} className={s.breakdownCell}>
                          <Breakdown entry={e} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
      </QueryState>
    </section>
  );
}
