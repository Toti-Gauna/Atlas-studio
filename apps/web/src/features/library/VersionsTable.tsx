"use client";
import type { DocumentVersion } from "@atlas/contracts";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, StatusBadge, Table, TechDetails, statusLabel } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

export function VersionsTable({ versions, selectedId, onView }: { versions: DocumentVersion[]; selectedId: string | null; onView: (v: DocumentVersion) => void }) {
  const C = L.detail.vcols;
  const newestFirst = [...versions].reverse();
  return (
    <div className={s.stackTight}>
      <Table caption={L.detail.versionsCaption} stack>
        <thead>
          <tr>
            <th scope="col">{C.version}</th>
            <th scope="col">{C.status}</th>
            <th scope="col">{C.created}</th>
            <th scope="col">
              <span className="sr-only">{C.view}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((v) => (
            <tr key={v.id} aria-current={v.id === selectedId ? "true" : undefined} className={v.id === selectedId ? s.rowNew : undefined}>
              <td data-label={C.version} className="tabular">
                v{v.version}
              </td>
              <td data-label={C.status}>
                <div className={s.statusCell}>
                  {v.published ? (
                    <Badge tone="teal">{L.detail.current}</Badge>
                  ) : v.status === "ready" ? (
                    <span className={s.muted}>{statusLabel("document", v.status)}</span>
                  ) : (
                    <StatusBadge kind="document" status={v.status} />
                  )}
                  {v.failureReason ? <span className={s.failReason}>{v.failureReason}</span> : null}
                </div>
              </td>
              <td data-label={C.created} className={s.nowrap}>
                {formatDateTime(v.createdAt)}
              </td>
              <td data-label={C.view}>
                {v.id === selectedId ? (
                  <span className={s.muted}>{L.detail.viewing}</span>
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
      <TechDetails>
        <dl className={s.techList}>
          {newestFirst.map((v) => (
            <div key={v.id} className={s.techRow}>
              <dt>v{v.version}</dt>
              <dd className="mono">
                {v.id} · SHA-256 {v.sha256} · {v.chunkCount} indexed chunks · {v.byteSize.toLocaleString("en-US")} bytes
              </dd>
            </div>
          ))}
        </dl>
      </TechDetails>
    </div>
  );
}
