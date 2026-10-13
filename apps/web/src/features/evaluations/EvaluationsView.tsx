"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import type { EvaluationSuite } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, modelName } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { evaluationsCopy as c } from "@/copy/evaluations";
import { Page } from "@/components/shell/StudioShell";
import { Button, Card, EmptyState, PageHeader, QueryState, SectionHead, Skeleton, StatusBadge, Table, TechDetails, numCell, useToast } from "@/components/ui";
import { CasesTable } from "./CasesTable";
import { RunResults } from "./RunResults";
import s from "./evaluations.module.css";

type RunMeta = EvaluationSuite["runs"][number];

/** Result first: passed/failed counts, which cases failed and what changed since the previous run. */
function LatestResult({ suite, latest, previous, onSeeAll }: { suite: EvaluationSuite; latest: RunMeta; previous: RunMeta | null; onSeeAll: () => void }) {
  const cur = useQuery({ queryKey: ["evaluation-run", latest.id], queryFn: () => api.evaluations.results(latest.id) });
  const prev = useQuery({ queryKey: ["evaluation-run", previous?.id], queryFn: () => api.evaluations.results(previous!.id), enabled: Boolean(previous) });
  const l = c.latest;
  const question = (id: string) => suite.cases.find((k) => k.id === id)?.question ?? id;
  const failed = (cur.data?.results ?? []).filter((r) => !r.passed);
  const before = new Map((prev.data?.results ?? []).map((r) => [r.caseId, r.passed]));
  const nowFailing = failed.filter((r) => before.get(r.caseId) === true);
  const nowPassing = (cur.data?.results ?? []).filter((r) => r.passed && before.get(r.caseId) === false);
  const delta = previous ? latest.passed - previous.passed : 0;
  const ok = latest.passed === latest.total;
  return (
    <Card className={s.latest} aria-labelledby={`latest-${suite.id}`}>
      <div className={s.latestHead}>
        <span className={ok ? s.iconOk : s.iconFail} aria-hidden>
          {ok ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
        </span>
        <div>
          <h3 id={`latest-${suite.id}`} className={s.latestTitle}>
            {l.summary(latest.passed, latest.total)}
            {!ok ? <> · {l.failedCount(latest.total - latest.passed)}</> : null}
          </h3>
          <p className={s.muted}>{l.ranAt(formatDateTime(latest.createdAt), modelName(latest.modelKey))}</p>
        </div>
      </div>
      {cur.isPending ? (
        <Skeleton lines={2} />
      ) : ok ? (
        <p className={s.line}>{l.allPassed}</p>
      ) : (
        <div>
          <p className={s.line}>{l.failedList}</p>
          <ul className={s.caseList}>
            {failed.map((r) => (
              <li key={r.caseId}>{question(r.caseId)}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className={s.line}>
          <strong>{l.vsPrevious}:</strong> {!previous ? l.noPrevious : delta > 0 ? l.better(delta) : delta < 0 ? l.worse(-delta) : nowFailing.length || nowPassing.length ? "" : l.same}
        </p>
        {nowFailing.length ? (
          <p className={s.muted}>
            {l.nowFailing} {nowFailing.map((r) => question(r.caseId)).join(" · ")}
          </p>
        ) : null}
        {nowPassing.length ? (
          <p className={s.muted}>
            {l.nowPassing} {nowPassing.map((r) => question(r.caseId)).join(" · ")}
          </p>
        ) : null}
      </div>
      <div>
        <Button size="sm" variant="ghost" onClick={onSeeAll}>
          {l.seeAll}
        </Button>
      </div>
    </Card>
  );
}

function SuiteBlock({ suite }: { suite: EvaluationSuite }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canRun = useCan("evaluation.run");
  const runs = [...suite.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const completed = runs.filter((r) => r.status === "completed");
  const [selected, setSelected] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => api.evaluations.run(suite.id),
    onSuccess: (r) => {
      qc.setQueryData(["evaluation-run", r.id], r);
      void qc.invalidateQueries({ queryKey: ["evaluation-suites"] });
      setSelected(null);
      toast({ tone: "success", title: c.runDone(r.passed, r.total) });
    },
    onError: (e) => toast({ tone: "error", title: c.runFailed, body: (e as Error).message }),
  });
  const scope = runs[0]?.scopeNote || c.scopeDefault;

  return (
    <section aria-labelledby={`suite-${suite.id}`} className={s.suite}>
      <div className={s.suiteHead}>
        <div>
          <h2 id={`suite-${suite.id}`} className={s.suiteTitle}>
            {suite.name}
          </h2>
          <p className={s.scope}>{scope}</p>
        </div>
        <div className={s.runAction}>
          <Button variant="primary" icon={<Play size={14} aria-hidden />} onClick={() => run.mutate()} loading={run.isPending} disabled={!canRun} aria-describedby={canRun ? undefined : `run-hint-${suite.id}`}>
            {c.run}
          </Button>
          {!canRun ? (
            <span id={`run-hint-${suite.id}`} className={s.muted}>
              {c.runAdminOnly}
            </span>
          ) : null}
        </div>
      </div>

      {completed[0] ? (
        <LatestResult key={completed[0].id} suite={suite} latest={completed[0]} previous={completed[1] ?? null} onSeeAll={() => setSelected(completed[0]!.id)} />
      ) : (
        <EmptyState title={c.latest.none} body={c.latest.noneBody} />
      )}

      {selected ? <RunResults runId={selected} suite={suite} /> : null}

      <details className={s.disclosure}>
        <summary>{c.cases.title(suite.cases.length)}</summary>
        <div className={s.disclosureBody}>
          <CasesTable suite={suite} />
        </div>
      </details>

      {runs.length ? (
        <div>
          <SectionHead title={c.runs.title} />
          <Table stack caption={c.runs.caption}>
            <thead>
              <tr>
                <th scope="col">{c.runs.created}</th>
                <th scope="col">{c.runs.model}</th>
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
                    <td className={s.nowrap}>{when}</td>
                    <td className={s.nowrap} data-label={c.runs.model}>{modelName(r.modelKey)}</td>
                    <td data-label={c.runs.status}>
                      <StatusBadge kind="run" status={r.status} />
                    </td>
                    <td className={numCell} data-label={c.runs.result}>{c.runs.passed(r.passed, r.total)}</td>
                    <td data-label={c.runs.view}>
                      <Button size="sm" variant="ghost" aria-expanded={open} aria-label={open ? c.runs.hide : c.runs.viewLabel(when)} onClick={() => setSelected(open ? null : r.id)}>
                        {open ? c.runs.hide : c.runs.view}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <TechDetails>
            <ul className={s.techList}>
              {runs.map((r) => (
                <li key={r.id}>
                  {formatDateTime(r.createdAt)} · corpus hash <span className="mono">{r.corpusVersionHash}</span> · config hash <span className="mono">{r.configHash}</span>
                </li>
              ))}
            </ul>
          </TechDetails>
        </div>
      ) : null}
    </section>
  );
}

/** Quality: behavior checks of the assistant, with counts — never accuracy percentages. */
export function EvaluationsView() {
  const q = useQuery({ queryKey: ["evaluation-suites"], queryFn: api.evaluations.suites });
  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} />
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
