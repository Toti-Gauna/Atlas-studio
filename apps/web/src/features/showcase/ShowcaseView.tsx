"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, ExternalLink, FileText } from "lucide-react";
import type { ShowcaseScenario } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { Page } from "@/components/shell/StudioShell";
import { Card, EmptyState, LinkButton, LoadingBlock, PageHeader, QueryState, StatusBadge } from "@/components/ui";
import { showcaseCopy as c } from "@/copy/showcase";
import { workflowHref } from "@/features/workflows/status";
import { tourSteps } from "./tourSteps";
import s from "./showcase.module.css";

export function ShowcaseView() {
  const scenarios = useQuery({ queryKey: ["demo-scenarios"], queryFn: api.demo.scenarios });
  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} />
      <p className={s.honesty}>{c.honesty}</p>
      <QueryState
        query={scenarios}
        isEmpty={(d) => d.length === 0}
        loading={<LoadingBlock rows={3} label="Loading tours" />}
        empty={<EmptyState icon={<Compass size={22} />} title={c.emptyTitle} body={c.emptyBody} />}
      >
        {(list) => (
          <ul className={s.grid} aria-label={c.listLabel}>
            {list.map((sc, i) => (
              <TourCard key={sc.id} sc={sc} n={i + 1} />
            ))}
          </ul>
        )}
      </QueryState>
    </Page>
  );
}

function TourCard({ sc, n }: { sc: ShowcaseScenario; n: number }) {
  const canArtifacts = useCan("artifact.read");
  const artifacts = useQuery({ queryKey: ["artifacts", sc.projectId], queryFn: () => api.artifacts.list(sc.projectId), enabled: canArtifacts && Boolean(sc.lastRun?.artifactIds.length) });
  const steps = tourSteps(sc);
  const headingId = `tour-${sc.slug}`;
  const titleOf = (id: string) => artifacts.data?.find((a) => a.id === id)?.title ?? id;

  return (
    <Card as="li" className={s.card} aria-labelledby={headingId}>
      <div className={s.cardTop}>
        <span className={s.num} aria-hidden>
          {String(n).padStart(2, "0")}
        </span>
      </div>
      <h2 id={headingId} className={s.title}>
        {sc.title}
      </h2>
      <p className={s.summary}>{sc.summary}</p>

      <ol className={s.steps} aria-label={c.stepsLabel(sc.title)}>
        {steps.map((st, i) => (
          <li key={st.key}>
            <Link href={st.href} className={s.step}>
              <span className={s.stepIdx} aria-hidden>
                {i + 1}
              </span>
              <span className={s.stepBody}>
                <span className={s.stepTitle}>{st.title}</span>
                <span className={s.stepDesc}>{st.waitsForRun ? c.afterRun : st.description}</span>
              </span>
              <ArrowRight size={14} aria-hidden className={s.stepArrow} />
            </Link>
          </li>
        ))}
      </ol>

      <section className={s.lastRun} aria-label={c.lastRun}>
        <div className={s.lastRunHead}>
          <span className={s.lastRunLabel}>{c.lastRun}</span>
          {sc.lastRun ? <StatusBadge kind="run" status={sc.lastRun.status} /> : null}
        </div>
        {sc.lastRun ? (
          <>
            <p className={s.muted}>
              {sc.lastRun.finishedAt ? (
                <>
                  {c.finished}{" "}
                  <time dateTime={sc.lastRun.finishedAt} title={formatDateTime(sc.lastRun.finishedAt)}>
                    {relativeTime(sc.lastRun.finishedAt)}
                  </time>
                </>
              ) : (
                c.notFinished
              )}{" "}
              · <Link href={workflowHref(sc.workflowId, { run: sc.lastRun.workflowRunId })}>{c.openRun}</Link>
            </p>
            {sc.lastRun.artifactIds.length ? (
              <div>
                <span className={s.muted}>{c.deliverables}</span>
                <ul className={s.artifacts}>
                  {sc.lastRun.artifactIds.map((id) => (
                    <li key={id}>
                      <Link href={`/app/artifact/?id=${id}`} className={s.artifact}>
                        <FileText size={14} aria-hidden /> {titleOf(id)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className={s.muted}>{c.noRun}</p>
        )}
      </section>

      <div className={s.foot}>
        <span className={s.muted}>{c.startHint}</span>
        <LinkButton variant="primary" href={workflowHref(sc.workflowId, { project: sc.projectId })} icon={<ExternalLink size={14} aria-hidden />}>
          {c.start}
        </LinkButton>
      </div>
    </Card>
  );
}
