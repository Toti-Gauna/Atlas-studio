"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Plus } from "lucide-react";
import type { ArtifactSummary } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { formatDateTime, relativeTime } from "@/lib/format";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Page } from "@/components/shell/StudioShell";
import { ArtifactIcon, Button, EmptyState, LinkButton, PageHeader, QueryState, Select, Table, numCell } from "@/components/ui";
import { ReviewStateBadge } from "@/features/artifacts/ArtifactWorkspace";
import { keys, useProjects } from "./queries";
import s from "./deliverables.module.css";

type Filters = { type: string; project: string; state: string };
const NONE: Filters = { type: "", project: "", state: "" };
/** "New deliverable" opens chat in Draft deliverable mode. */
const NEW_HREF = "/app/chat/?new=1&mode=draft_artifact";

export function DeliverablesView() {
  const artifacts = useQuery({ queryKey: keys.artifacts, queryFn: () => api.artifacts.list() });
  const projects = useProjects();
  const canWrite = useCan("artifact.write");
  const [f, setF] = useState<Filters>(NONE);
  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const filtered = useMemo(
    () => (artifacts.data ?? []).filter((a) => (!f.type || a.type === f.type) && (!f.project || a.projectId === f.project) && (!f.state || a.reviewState === f.state)),
    [artifacts.data, f],
  );
  const active = f.type || f.project || f.state;

  return (
    <Page wide>
      <PageHeader
        title={c.list.title}
        description={c.list.description}
        actions={canWrite ? <LinkButton href={NEW_HREF} variant="primary" icon={<Plus size={14} aria-hidden />}>{c.list.newCta}</LinkButton> : null}
      />
      <QueryState
        query={artifacts}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title={c.list.emptyTitle} body={c.list.emptyBody} action={canWrite ? <LinkButton href={NEW_HREF} variant="primary" icon={<MessageSquarePlus size={14} aria-hidden />}>{c.list.emptyCta}</LinkButton> : null} />}
      >
        {(all) => (
          <>
            <div className={s.filters} role="group" aria-label={c.list.filtersLabel}>
              <Select label={c.list.filters.type} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: "", label: c.list.allTypes }, ...Object.entries(c.types).map(([value, label]) => ({ value, label }))]} />
              <Select
                label={c.list.filters.project}
                value={f.project}
                onChange={(e) => setF({ ...f, project: e.target.value })}
                options={[{ value: "", label: c.list.allProjects }, ...[...new Set(all.map((a) => a.projectId))].map((id) => ({ value: id, label: projectName.get(id) ?? id }))]}
              />
              <Select label={c.list.filters.review} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={[{ value: "", label: c.list.allStates }, ...Object.entries(c.reviewStates).map(([value, label]) => ({ value, label }))]} />
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
  const k = c.list.cols;
  return (
    <Table caption={c.list.caption} stack>
      <thead>
        <tr>
          <th scope="col">{k.title}</th>
          <th scope="col">{k.project}</th>
          <th scope="col" className={numCell}>{k.version}</th>
          <th scope="col">{k.review}</th>
          <th scope="col">{k.owner}</th>
          <th scope="col">{k.updated}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td data-label={k.title}>
              <Link href={`/app/artifact/?id=${a.id}`} className={s.titleLink}>
                <span className={s.typeIcon} title={c.types[a.type]}>
                  <ArtifactIcon type={a.type} />
                  <span className="sr-only">{c.types[a.type] ?? a.type}: </span>
                </span>
                <span>{a.title}</span>
              </Link>
            </td>
            <td data-label={k.project}>{projectName.get(a.projectId) ?? "—"}</td>
            <td data-label={k.version} className={numCell}>v{a.currentVersion}</td>
            <td data-label={k.review}>{a.reviewState === "draft" ? <span className={s.muted}>{c.reviewStates.draft}</span> : <ReviewStateBadge state={a.reviewState} />}</td>
            <td data-label={k.owner}>{a.ownerName}</td>
            <td data-label={k.updated}>
              <time dateTime={a.updatedAt} title={formatDateTime(a.updatedAt)}>{relativeTime(a.updatedAt)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
