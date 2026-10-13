"use client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import type { EvaluationSuite } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { evaluationsCopy as c } from "@/copy/evaluations";
import { Badge, QueryState, SectionHead, Table } from "@/components/ui";
import s from "./evaluations.module.css";

export function RunResults({ runId, suite }: { runId: string; suite: EvaluationSuite }) {
  const q = useQuery({ queryKey: ["evaluation-run", runId], queryFn: () => api.evaluations.results(runId) });
  return (
    <div aria-live="polite">
      <QueryState query={q}>
        {(run) => (
          <section aria-labelledby={`res-${run.id}`}>
            <SectionHead id={`res-${run.id}`} title={c.results.title(formatDateTime(run.createdAt))} aside={c.runs.passed(run.passed, run.total)} />
            <Table stack caption={c.results.caption}>
              <thead>
                <tr>
                  <th scope="col">{c.results.case}</th>
                  <th scope="col">{c.results.outcome}</th>
                  <th scope="col">{c.results.observed}</th>
                  <th scope="col">{c.results.cited}</th>
                  <th scope="col">{c.results.detail}</th>
                </tr>
              </thead>
              <tbody>
                {[...run.results]
                  .sort((a, b) => Number(a.passed) - Number(b.passed))
                  .map((r) => {
                    const k = suite.cases.find((x) => x.id === r.caseId);
                    return (
                      <tr key={r.caseId}>
                        <td className={s.question}>
                          {k?.question ?? r.caseId}
                          {k ? <div className={s.muted}>{c.expectation[k.expectation]}</div> : null}
                        </td>
                        <td data-label={c.results.outcome}>
                          <Badge tone={r.passed ? "teal" : "danger"} icon={r.passed ? <CheckCircle2 size={12} aria-hidden /> : <XCircle size={12} aria-hidden />}>
                            {r.passed ? c.results.pass : c.results.fail}
                          </Badge>
                        </td>
                        <td data-label={c.results.observed}>{c.observed[r.observed] ?? r.observed}</td>
                        <td data-label={c.results.cited}>{r.citedDocumentTitle ?? "—"}</td>
                        <td className={s.muted} data-label={c.results.detail}>
                          {r.detail}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </Table>
          </section>
        )}
      </QueryState>
    </div>
  );
}
