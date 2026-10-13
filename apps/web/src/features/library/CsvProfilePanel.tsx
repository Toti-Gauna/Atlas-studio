"use client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ColumnProfile } from "@atlas/domain";
import { api } from "@/lib/api";
import { Badge, Callout, Card, DescList, QueryState, SectionHead, Table, TechDetails, numCell } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const DELIM: Record<string, string> = { ",": "comma (,)", ";": "semicolon (;)", "\t": "tab", "|": "pipe (|)" };

function StatsCell({ c }: { c: ColumnProfile }) {
  if (c.numeric) return <span className="tabular">{[c.numeric.mean, c.numeric.median, c.numeric.min, c.numeric.max].map(num).join(" · ")}</span>;
  if (c.dateRange) return <span className="tabular">{c.dateRange.min} → {c.dateRange.max}</span>;
  return <span className={s.muted}>—</span>;
}

/** Every number here comes from the deterministic profiler on the server; nothing is estimated. */
export function CsvProfilePanel({ documentId }: { documentId: string }) {
  const q = useQuery({ queryKey: ["csv-profile", documentId], queryFn: () => api.documents.csvProfile(documentId) });
  const C = L.csv.cols;
  return (
    <QueryState query={q}>
      {(p) => (
        <div className={s.stack}>
          <Card>
            <SectionHead
              title={L.csv.heading}
              aside={
                p.valid ? (
                  <Badge tone="teal" icon={<CheckCircle2 size={12} aria-hidden />}>{L.csv.valid}</Badge>
                ) : (
                  <Badge tone="danger" icon={<XCircle size={12} aria-hidden />}>{L.csv.invalid}</Badge>
                )
              }
            />
            <DescList
              items={[
                [L.csv.rows, <span key="r" className="tabular">{num(p.rowCount)}</span>],
                [L.csv.columns, <span key="c" className="tabular">{num(p.columnCount)}</span>],
                [L.csv.delimiter, DELIM[p.delimiter] ?? p.delimiter],
              ]}
            />
            <p className={s.note}>{L.csv.deterministic}</p>
            <div className={s.techGap}>
              <TechDetails>
                {L.csv.method}: {p.method}
              </TechDetails>
            </div>
          </Card>

          {p.issues.length ? (
            <section aria-labelledby="csv-issues-h">
              <SectionHead id="csv-issues-h" title={`${L.csv.issues} (${p.issues.length})`} />
              <ul className={s.issues}>
                {p.issues.map((i, idx) => (
                  <li key={`${i.code}-${idx}`}>
                    <Callout tone={i.severity === "error" ? "danger" : "warn"}>
                      {i.message}
                      {i.row !== null ? ` (${L.csv.rowRef(i.row)})` : ""}
                      {i.column ? ` · ${L.csv.columnRef(i.column)}` : ""}
                    </Callout>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="csv-cols-h">
            <SectionHead id="csv-cols-h" title={L.csv.columnsCaption} />
            <Table caption={L.csv.columnsCaption} stack>
              <thead>
                <tr>
                  <th scope="col">{C.name}</th>
                  <th scope="col">{C.type}</th>
                  <th scope="col" className={numCell}>{C.missing}</th>
                  <th scope="col" className={numCell}>{C.distinct}</th>
                  <th scope="col">{C.stats} / {C.range}</th>
                  <th scope="col">{C.top}</th>
                </tr>
              </thead>
              <tbody>
                {p.columns.map((c) => (
                  <tr key={c.name}>
                    <th scope="row" className={s.colName}>{c.name}</th>
                    <td data-label={C.type} className={s.colType}>{c.kind}</td>
                    <td data-label={C.missing} className={numCell}>{num(c.missing)}</td>
                    <td data-label={C.distinct} className={numCell}>{num(c.distinct)}</td>
                    <td data-label={`${C.stats} / ${C.range}`}>
                      <StatsCell c={c} />
                    </td>
                    <td data-label={C.top}>
                      <span className={s.topValues}>
                        {c.topValues.length ? c.topValues.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(", ") : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        </div>
      )}
    </QueryState>
  );
}
