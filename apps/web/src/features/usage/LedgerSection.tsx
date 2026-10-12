"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LedgerEntry } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, modelName, money, ms, tokens } from "@/lib/format";
import { usageCopy as c } from "@/copy/usage";
import { Badge, EmptyState, IconButton, QueryState, SectionHead, Table, numCell, type Tone } from "@/components/ui";
import s from "./usage.module.css";

const COST_TONE: Record<LedgerEntry["costStatus"], Tone> = { no_provider_charge: "teal", calculated: "neutral", estimated: "info", unknown: "warn", reconciled: "teal" };
const STATUS_TONE: Record<LedgerEntry["status"], Tone> = { succeeded: "teal", failed: "danger", cancelled: "warn" };

function costCell(e: LedgerEntry) {
  if (e.costStatus === "no_provider_charge") return "$0 · local";
  if (e.costStatus === "unknown" || e.costNanoUsd === null) return "Unknown (not zero)";
  return money(e.costNanoUsd);
}

function Breakdown({ entry }: { entry: LedgerEntry }) {
  if (!entry.breakdown.length) return <p className={s.muted}>{c.ledger.noBreakdown}</p>;
  return (
    <table className={s.subTable}>
      <caption className="sr-only">{`${c.ledger.breakdown} · attempt ${entry.attemptNumber}`}</caption>
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
            <td className={numCell}>{b.unitPriceUsdPerMTok === null ? "Unknown" : `$${b.unitPriceUsdPerMTok}`}</td>
            <td className={numCell}>{b.nanoUsd === null ? "Unknown (not zero)" : money(b.nanoUsd)}</td>
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
    <section aria-labelledby="ledger-h" className={s.section}>
      <SectionHead id="ledger-h" title={c.ledger.title} aside={q.data?.items.length === 100 ? c.ledger.truncated(100) : undefined} />
      <QueryState query={q} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title={c.ledger.empty} />}>
        {(page) => (
          <Table caption={c.ledger.caption}>
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
                      <td>
                        <IconButton size="sm" label={expanded ? c.ledger.hideBreakdown(e.attemptNumber) : c.ledger.showBreakdown(e.attemptNumber)} aria-expanded={expanded} aria-controls={expanded ? `bd-${e.id}` : undefined} onClick={() => toggle(e.id)}>
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </IconButton>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.occurredAt)}</td>
                      <td>
                        <Link href={`/app/runs/?id=${e.runId}`} className="mono">
                          {e.runId}
                        </Link>
                      </td>
                      <td className={numCell}>#{e.attemptNumber}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{e.providerRequestId ?? "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{modelName(e.modelKey)}</td>
                      <td><Badge tone={STATUS_TONE[e.status]}>{c.runStatus[e.status]}</Badge></td>
                      <td className={numCell}>
                        {tokens(u.inputUncachedTokens)} / {tokens(u.outputTokens)} / {tokens(u.cacheReadTokens)} / {u.cacheWrite5mTokens === null && u.cacheWrite1hTokens === null ? "—" : tokens((u.cacheWrite5mTokens ?? 0) + (u.cacheWrite1hTokens ?? 0))}
                        {u.thinkingTokensReported ? <div className={s.muted}>thinking {tokens(u.thinkingTokensReported)} (in output)</div> : null}
                      </td>
                      <td><Badge tone={COST_TONE[e.costStatus]}>{c.costStatus[e.costStatus]}</Badge></td>
                      <td className={numCell}>{costCell(e)}</td>
                      <td className={numCell}>{ms(e.latencyMs)}</td>
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
