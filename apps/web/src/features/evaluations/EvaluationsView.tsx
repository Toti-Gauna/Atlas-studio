"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Play } from "lucide-react";
import type { EvaluationSuite } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, modelName } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { evaluationsCopy as c } from "@/copy/evaluations";
import { Page } from "@/components/shell/StudioShell";
import { Badge, Button, Callout, DemoTag, EmptyState, PageHeader, QueryState, SectionHead, Table, numCell, useToast } from "@/components/ui";
import { CasesTable } from "./CasesTable";
import { RunResults } from "./RunResults";
import s from "./evaluations.module.css";

const RUN_TONE = { running: "info", completed: "teal", failed: "danger" } as const;

function SuiteBlock({ suite }: { suite: EvaluationSuite }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canRun = useCan("evaluation.run");
  const runs = [...suite.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [selected, setSelected] = useState<string | null>(runs[0]?.id ?? null);
  const run = useMutation({
    mutationFn: () => api.evaluations.run(suite.id),
    onSuccess: (r) => {
      qc.setQueryData(["evaluation-run", r.id], r);
      void qc.invalidateQueries({ queryKey: ["evaluation-suites"] });
      setSelected(r.id);
      toast({ tone: "success", title: c.runDone(r.passed, r.total) });
    },
    onError: (e) => toast({ tone: "error", title: c.runFailed, body: (e as Error).message }),
  });
  const scope = runs[0]?.scopeNote || c.scopeDefault;

  return (
    <section aria-labelledby={`suite-${suite.id}`} className={s.suite}>
      <div className={s.suiteHead}>
        <h2 id={`suite-${suite.id}`} className={s.suiteTitle}>
          {suite.name} {suite.label === "DEMO" ? <DemoTag /> : null}
        </h2>
        <div className={s.runAction}>
          <Button variant="primary" icon={<Play size={14} aria-hidden />} onClick={() => run.mutate()} loading={run.isPending} disabled={!canRun} aria-describedby={canRun ? undefined : `run-hint-${suite.id}`}>
            {c.run}
          </Button>
          {!canRun ? <span id={`run-hint-${suite.id}`} className={s.muted}>{c.runAdminOnly}</span> : null}
        </div>
      </div>
      <Callout tone="info" icon={<FlaskConical size={16} aria-hidden />}>
        <strong>{scope}</strong>
      </Callout>

      <div>
        <SectionHead title={c.cases.title} aside={`${suite.cases.length} cases`} />
        <CasesTable suite={suite} />
      </div>

      <div>
        <SectionHead title={c.runs.title} />
        {runs.length === 0 ? (
          <EmptyState title={c.runs.empty} body={c.runs.emptyBody} />
        ) : (
          <Table caption={c.runs.caption}>
            <thead>
              <tr>
                <th scope="col">{c.runs.created}</th>
                <th scope="col">{c.runs.model}</th>
                <th scope="col">{c.runs.corpus}</th>
                <th scope="col">{c.runs.config}</th>
                <th scope="col">{c.runs.status}</th>
                <th scope="col" className={numCell}>{c.runs.result}</th>
                <th scope="col"><span className="sr-only">{c.runs.view}</span></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const when = formatDateTime(r.createdAt);
                const open = selected === r.id;
                return (
                  <tr key={r.id} aria-current={open || undefined} className={open ? s.selectedRow : undefined}>
                    <td style={{ whiteSpace: "nowrap" }}>{when}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{modelName(r.modelKey)}</td>
                    <td className="mono" title={r.corpusVersionHash}>{r.corpusVersionHash.slice(0, 12)}</td>
                    <td className="mono" title={r.configHash}>{r.configHash.slice(0, 12)}</td>
                    <td><Badge tone={RUN_TONE[r.status]}>{c.runs.statusLabel[r.status]}</Badge></td>
                    <td className={numCell}>{c.runs.passed(r.passed, r.total)}</td>
                    <td>
                      <Button size="sm" variant="ghost" aria-expanded={open} aria-label={open ? c.runs.hide : c.runs.viewLabel(when)} onClick={() => setSelected(open ? null : r.id)}>
                        {open ? c.runs.hide : c.runs.view}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>

      {selected ? <RunResults runId={selected} suite={suite} /> : null}
    </section>
  );
}

/** Evaluations (core): behavior checks with counts, never accuracy percentages. */
export function EvaluationsView() {
  const q = useQuery({ queryKey: ["evaluation-suites"], queryFn: api.evaluations.suites });
  return (
    <Page wide>
      <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.emptySuites} body={c.emptySuitesBody} />}>
        {(suites) => (
          <div className={s.suites}>
            {suites.map((suite) => (
              <SuiteBlock key={suite.id} suite={suite} />
            ))}
          </div>
        )}
      </QueryState>
    </Page>
  );
}
