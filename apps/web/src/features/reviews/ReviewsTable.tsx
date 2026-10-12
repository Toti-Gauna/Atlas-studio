import Link from "next/link";
import type { ReviewRequest } from "@atlas/contracts";
import { formatDateTime, relativeTime } from "@/lib/format";
import { reviewsCopy as c } from "@/copy/reviews";
import { Badge, Table, numCell } from "@/components/ui";
import { REQUEST_TONE, requestLabel } from "./status";
import s from "./reviews.module.css";

function When({ iso, prefix }: { iso: string; prefix: string }) {
  return (
    <div>
      {prefix} <time dateTime={iso} title={formatDateTime(iso)}>{relativeTime(iso)}</time>
    </div>
  );
}

export function ReviewsTable({ rows, caption }: { rows: ReviewRequest[]; caption: string }) {
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <th scope="col">{c.cols.artifact}</th>
          <th scope="col" className={numCell}>{c.cols.version}</th>
          <th scope="col">{c.cols.requester}</th>
          <th scope="col">{c.cols.reviewer}</th>
          <th scope="col">{c.cols.status}</th>
          <th scope="col">{c.cols.dates}</th>
          <th scope="col">{c.cols.note}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={`/app/artifact/?id=${r.artifactId}`} className={s.link}>
                {r.artifactTitle}
              </Link>
            </td>
            <td className={numCell}>v{r.version}</td>
            <td>{r.requestedByName}</td>
            <td>{r.reviewerName}</td>
            <td>
              <Badge tone={REQUEST_TONE[r.status]}>{requestLabel(r.status)}</Badge>
            </td>
            <td className={s.dates}>
              <When iso={r.createdAt} prefix="Requested" />
              {r.decidedAt ? <When iso={r.decidedAt} prefix="Decided" /> : null}
            </td>
            <td className={s.note}>{r.decisionNote ?? <span className={s.none}>—</span>}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
