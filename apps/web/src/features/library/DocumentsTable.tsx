"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import type { DocumentSummary, Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Badge, Table, numCell } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import { ClassificationBadge, StatusBadge } from "./docBadges";
import s from "./library.module.css";

/** The summary has no failure reason; failed rows read it from the latest version (real server text). */
export function FailureReason({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["document", id, null], queryFn: () => api.documents.get(id) });
  const reason = q.data ? [...q.data.versions].reverse().find((v) => v.failureReason)?.failureReason : null;
  if (!reason) return null;
  return <span className={s.failReason}>{reason}</span>;
}

export function DocumentsTable({ docs, projects, highlightId, caption = L.list.caption }: { docs: DocumentSummary[]; projects: Project[] | undefined; highlightId?: string | null; caption?: string }) {
  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? id;
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <th scope="col">{L.list.cols.title}</th>
          <th scope="col">{L.list.cols.kind}</th>
          <th scope="col">{L.list.cols.projects}</th>
          <th scope="col">{L.list.cols.classification}</th>
          <th scope="col" className={numCell}>{L.list.cols.findings}</th>
          <th scope="col">{L.list.cols.version}</th>
          <th scope="col">{L.list.cols.status}</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((d) => (
          <tr key={d.id} className={d.id === highlightId ? s.rowNew : undefined}>
            <td>
              <div className={s.titleCell}>
                <Link href={`/app/document/?id=${d.id}`} className={s.docLink}>
                  {d.title}
                </Link>
                <span className={s.subtle}>
                  {d.id === highlightId ? <Badge tone="teal">{L.list.newlyUploaded}</Badge> : null}
                  {relativeTime(d.updatedAt)}
                </span>
              </div>
            </td>
            <td>{L.kind[d.kind]}</td>
            <td>
              <span className={s.projectList}>{d.projectIds.map(projectName).join(", ") || "—"}</span>
            </td>
            <td>
              <ClassificationBadge value={d.classification} />
            </td>
            <td className={numCell}>
              {d.sensitiveFindingCount > 0 ? (
                <Link href="/app/privacy/" className={s.findings} aria-label={L.list.findingsLink(d.sensitiveFindingCount)} title={L.list.findingsLink(d.sensitiveFindingCount)}>
                  <ShieldAlert size={14} aria-hidden />
                  {d.sensitiveFindingCount}
                </Link>
              ) : (
                <span className={s.subtle}>0</span>
              )}
            </td>
            <td className="tabular">{d.publishedVersion ? `v${d.publishedVersion}` : <span className={s.subtle}>{L.list.notPublished}</span>}</td>
            <td>
              <div className={s.statusCell}>
                <StatusBadge status={d.latestStatus} />
                {d.latestStatus === "failed" ? <FailureReason id={d.id} /> : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
