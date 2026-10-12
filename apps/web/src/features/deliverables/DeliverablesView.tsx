"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import type { ArtifactSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Page } from "@/components/shell/StudioShell";
import { ArtifactIcon, Badge, Button, DemoTag, EmptyState, LinkButton, PageHeader, QueryState, Select, Table, numCell } from "@/components/ui";
import { REVIEW_LABEL, REVIEW_TONE } from "@/features/artifacts/ArtifactWorkspace";
import { keys, useProjects } from "./queries";
import s from "./deliverables.module.css";

type Filters = { type: string; project: string; state: string };
const NONE: Filters = { type: "", project: "", state: "" };

export function DeliverablesView() {
  const artifacts = useQuery({ queryKey: keys.artifacts, queryFn: () => api.artifacts.list() });
  const projects = useProjects();
  const [f, setF] = useState<Filters>(NONE);
  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const filtered = useMemo(
    () => (artifacts.data ?? []).filter((a) => (!f.type || a.type === f.type) && (!f.project || a.projectId === f.project) && (!f.state || a.reviewState === f.state)),
    [artifacts.data, f],
  );
  const active = f.type || f.project || f.state;

  return (
    <Page wide>
      <PageHeader eyebrow={c.list.eyebrow} title={c.list.title} description={c.list.description} meta={<DemoTag />} />
      <QueryState
        query={artifacts}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title={c.list.emptyTitle} body={c.list.emptyBody} action={<LinkButton href="/app/chat/?new=1" variant="primary" icon={<MessageSquarePlus size={14} aria-hidden />}>{c.list.emptyCta}</LinkButton>} />}
      >
        {(all) => (
          <>
            <div className={s.filters} role="group" aria-label={c.list.filtersLabel}>
              <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: "", label: c.list.allTypes }, ...Object.entries(c.types).map(([value, label]) => ({ value, label }))]} />
              <Select
                label="Project"
                value={f.project}
                onChange={(e) => setF({ ...f, project: e.target.value })}
                options={[{ value: "", label: c.list.allProjects }, ...[...new Set(all.map((a) => a.projectId))].map((id) => ({ value: id, label: projectName.get(id) ?? id }))]}
              />
              <Select label="Review state" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={[{ value: "", label: c.list.allStates }, ...Object.entries(REVIEW_LABEL).map(([value, label]) => ({ value, label }))]} />
              <p className={s.count} aria-live="polite">{c.list.count(filtered.length)}</p>
            </div>
            {filtered.length === 0 ? (
              <EmptyState title={c.list.noMatchTitle} action={active ? <Button onClick={() => setF(NONE)}>{c.list.clearFilters}</Button> : null} />
            ) : (
              <ArtifactTable rows={filtered} projectName={projectName} />
            )}
          </>
        )}
      </QueryState>
    </Page>
  );
}

function ArtifactTable({ rows, projectName }: { rows: ArtifactSummary[]; projectName: Map<string, string> }) {
  return (
    <Table caption={c.list.caption}>
      <thead>
        <tr>
          <th scope="col">Artifact</th>
          <th scope="col">Project</th>
          <th scope="col" className={numCell}>Version</th>
          <th scope="col">Review</th>
          <th scope="col">Owner</th>
          <th scope="col">My role</th>
          <th scope="col" className={numCell}>Sources</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td>
              <Link href={`/app/artifact/?id=${a.id}`} className={s.titleLink}>
                <span className={s.typeIcon} title={c.types[a.type]}>
                  <ArtifactIconLabeled type={a.type} />
                </span>
                <span>{a.title}</span>
              </Link>
              {a.label === "DEMO" ? <span className={s.inlineTag}><DemoTag /></span> : null}
            </td>
            <td>{projectName.get(a.projectId) ?? <span className="mono">{a.projectId}</span>}</td>
            <td className={numCell}>v{a.currentVersion}</td>
            <td>
              <Badge tone={REVIEW_TONE[a.reviewState]}>{REVIEW_LABEL[a.reviewState]}</Badge>
            </td>
            <td>{a.ownerName}</td>
            <td>
              <Badge tone="violet">{c.roles[a.myRole]}</Badge>
            </td>
            <td className={numCell}>{a.sourceCount}</td>
            <td>
              <time dateTime={a.updatedAt} title={formatDateTime(a.updatedAt)}>{relativeTime(a.updatedAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function ArtifactIconLabeled({ type }: { type: string }) {
  return (
    <>
      <ArtifactIcon type={type} />
      <span className="sr-only">{c.types[type] ?? type}: </span>
    </>
  );
}
