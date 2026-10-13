"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import type { DocumentSummary, Project } from "@atlas/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Badge, Table } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import { ClassificationText, DocStatus } from "./docBadges";
import s from "./library.module.css";

/** The summary has no failure reason; failed rows read it from the latest version (real server text). */
export function FailureReason({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["document", id, null], queryFn: () => api.documents.get(id) });
  const reason = q.data ? [...q.data.versions].reverse().find((v) => v.failureReason)?.failureReason : null;
  if (!reason) return null;
  return <span className={s.failReason}>{reason}</span>;
}

/** Title, projects, classification, updated. Status and sensitive findings appear only as exceptions. */
export function DocumentsTable({ docs, projects, highlightId, caption = L.list.caption }: { docs: DocumentSummary[]; projects: Project[] | undefined; highlightId?: string | null; caption?: string }) {
  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? id;
  const C = L.list.cols;
  return (
    <Table caption={caption} stack>
      <thead>
        <tr>
          <th scope="col">{C.title}</th>
          <th scope="col">{C.projects}</th>
          <th scope="col">{C.classification}</th>
          <th scope="col">{C.updated}</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((d) => {
          const exceptions = d.id === highlightId || d.latestStatus !== "ready" || d.sensitiveFindingCount > 0;
          return (
            <tr key={d.id} className={d.id === highlightId ? s.rowNew : undefined}>
              <td data-label={C.title}>
                <div className={s.titleCell}>
                  <span className={s.titleLine}>
                    <Link href={`/app/document/?id=${d.id}`} className={s.docLink}>
                      {d.title}
                    </Link>
                    <span className={s.kind}>{L.kind[d.kind]}</span>
                  </span>
                  {exceptions ? (
                    <span className={s.rowExceptions}>
                      {d.id === highlightId ? <Badge tone="teal">{L.list.newlyUploaded}</Badge> : null}
                      <DocStatus status={d.latestStatus} />
                      {d.sensitiveFindingCount > 0 ? (
                        <Link href="/app/privacy/" className={s.findings}>
                          <ShieldAlert size={14} aria-hidden />
                          {L.list.findingsLink(d.sensitiveFindingCount)}
                        </Link>
                      ) : null}
                    </span>
                  ) : null}
                  {d.latestStatus === "failed" ? <FailureReason id={d.id} /> : null}
                </div>
              </td>
              <td data-label={C.projects}>
                <span className={s.projectList}>{d.projectIds.map(projectName).join(", ") || "—"}</span>
              </td>
              <td data-label={C.classification}>
                <ClassificationText value={d.classification} />
              </td>
              <td data-label={C.updated} className={s.nowrap}>
                {relativeTime(d.updatedAt)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
