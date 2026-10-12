"use client";
import type { DocumentVersion } from "@atlas/contracts";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Table, numCell } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import { StatusBadge } from "./docBadges";
import s from "./library.module.css";

export function VersionsTable({ versions, selectedId, onView }: { versions: DocumentVersion[]; selectedId: string | null; onView: (v: DocumentVersion) => void }) {
  const C = L.detail.vcols;
  return (
    <Table caption={L.detail.versionsCaption}>
      <thead>
        <tr>
          <th scope="col">{C.version}</th>
          <th scope="col">{C.status}</th>
          <th scope="col">{C.published}</th>
          <th scope="col" className={numCell}>{C.chunks}</th>
          <th scope="col">{C.sha}</th>
          <th scope="col">{C.created}</th>
          <th scope="col">
            <span className="sr-only">{C.view}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {[...versions].reverse().map((v) => (
          <tr key={v.id} aria-current={v.id === selectedId ? "true" : undefined} className={v.id === selectedId ? s.rowNew : undefined}>
            <td className="tabular">v{v.version}</td>
            <td>
              <div className={s.statusCell}>
                <StatusBadge status={v.status} reason={v.failureReason} />
                {v.failureReason ? <span className={s.failReason}>{v.failureReason}</span> : null}
              </div>
            </td>
            <td>{v.published ? <Badge tone="teal">{L.detail.published}</Badge> : <span className={s.subtle}>—</span>}</td>
            <td className={numCell}>{v.chunkCount}</td>
            <td>
              <span className={`mono ${s.sha}`} title={v.sha256}>
                {v.sha256.length > 22 ? `${v.sha256.slice(0, 22)}…` : v.sha256}
              </span>
            </td>
            <td className={s.nowrap}>{formatDateTime(v.createdAt)}</td>
            <td>
              {v.id === selectedId ? (
                <Badge>{L.detail.viewing}</Badge>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => onView(v)}>
                  {L.detail.viewVersion(v.version)}
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
