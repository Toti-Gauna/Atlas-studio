import Link from "next/link";
import type { ReviewRequest } from "@atlas/contracts";
import { formatDateTime, relativeTime } from "@/lib/format";
import { reviewsCopy as c } from "@/copy/reviews";
import { LinkButton, StatusBadge } from "@/components/ui";
import s from "./reviews.module.css";

/** Reviews as a task list: "Vendor checklist gap report v2 · from Leo Brandt · 3 h ago · [Review]". */
export function ReviewsTable({ rows, caption, me }: { rows: ReviewRequest[]; caption: string; me?: string }) {
  return (
    <ul className={s.tasks} aria-label={caption}>
      {rows.map((r) => {
        const href = `/app/artifact/?id=${r.artifactId}`;
        const mineToDo = r.status === "open" && r.reviewerId === me;
        const who = r.reviewerId === me ? c.task.from(r.requestedByName) : r.requestedBy === me ? c.task.to(r.reviewerName) : c.task.between(r.requestedByName, r.reviewerName);
        return (
          <li key={r.id} className={s.task}>
            <div className={s.taskMain}>
              <Link href={href} className={s.link}>
                {r.artifactTitle} v{r.version}
              </Link>
              <div className={s.taskMeta}>
                <span>{who}</span>
                <span aria-hidden>·</span>
                <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)}>{relativeTime(r.createdAt)}</time>
                {r.decidedAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={r.decidedAt} title={formatDateTime(r.decidedAt)}>{c.task.decided(relativeTime(r.decidedAt))}</time>
                  </>
                ) : null}
              </div>
              {r.decisionNote ? (
                <blockquote className={s.note}>
                  <span className="sr-only">{c.task.note}: </span>
                  {r.decisionNote}
                </blockquote>
              ) : null}
            </div>
            <div className={s.taskSide}>
              <StatusBadge kind="review" status={r.status} />
              <LinkButton href={href} size="sm" variant={mineToDo ? "primary" : "secondary"}>
                {mineToDo ? c.task.review : c.task.open}
              </LinkButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
