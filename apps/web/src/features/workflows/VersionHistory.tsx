"use client";
import type { WorkflowDetail } from "@atlas/contracts";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Badge, Card, SectionHead } from "@/components/ui";
import { wfCopy } from "@/copy/workflows";
import s from "./workflows.module.css";

export function VersionHistory({ workflow }: { workflow: WorkflowDetail }) {
  const c = wfCopy.versions;
  const versions = [...workflow.versions].sort((a, b) => b.version - a.version);
  return (
    <Card>
      <SectionHead title={c.title} />
      <ol className={s.versionList} aria-label={c.caption}>
        {versions.map((v) => (
          <li key={v.id} className={s.versionRow}>
            <div className={s.versionTop}>
              <strong>{c.version(v.version)}</strong>
              {v.version === workflow.currentVersion ? <Badge tone="teal">{c.current}</Badge> : null}
              <span className={s.muted}>
                {c.steps(v.steps.length)} ·{" "}
                <time dateTime={v.createdAt} title={formatDateTime(v.createdAt)}>
                  {relativeTime(v.createdAt)}
                </time>
              </span>
            </div>
            <p className={s.versionNote}>{v.changeNote}</p>
            <p className={s.versionSteps}>{v.steps.map((st) => st.title).join(" → ")}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
