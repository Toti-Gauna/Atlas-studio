import type { ReviewRequest } from "@atlas/contracts";
import { formatDateTime, relativeTime } from "@/lib/format";
import { reviewsCopy as c } from "@/copy/reviews";
import { Badge } from "@/components/ui";
import { REQUEST_TONE, requestLabel } from "@/features/reviews/status";
import s from "./deliverables.module.css";

export function ReviewRequestItem({ r, currentVersion }: { r: ReviewRequest; currentVersion: number }) {
  const stale = r.status === "open" && r.version !== currentVersion;
  const status = stale ? "superseded" : r.status;
  return (
    <li className={s.reviewItem}>
      <div className={s.reviewTop}>
        <Badge mono>v{r.version}</Badge>
        <Badge tone={REQUEST_TONE[status]}>{requestLabel(status)}</Badge>
        <span className={s.grow}>
          {r.requestedByName} → <strong>{r.reviewerName}</strong>
        </span>
      </div>
      <div className={s.meta}>
        <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)}>{c.panel.requestedOn(relativeTime(r.createdAt))}</time>
        {r.decidedAt ? (
          <>
            {" · "}
            <time dateTime={r.decidedAt} title={formatDateTime(r.decidedAt)}>{c.panel.decidedOn(relativeTime(r.decidedAt))}</time>
          </>
        ) : null}
      </div>
      {r.version !== currentVersion && (r.status === "open" || r.status === "superseded") ? <div className={s.meta}>{c.panel.staleVersion(r.version, currentVersion)}</div> : null}
      {r.decisionNote ? <blockquote className={s.quote}>{r.decisionNote}</blockquote> : null}
    </li>
  );
}
