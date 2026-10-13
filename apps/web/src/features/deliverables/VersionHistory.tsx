import type { ArtifactDetail } from "@atlas/contracts";
import { formatDateTime, relativeTime } from "@/lib/format";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { ReviewStateBadge } from "@/features/artifacts/ArtifactWorkspace";
import { cleanNote } from "./queries";
import s from "./deliverables.module.css";

export function VersionHistory({ detail }: { detail: ArtifactDetail }) {
  const versions = [...detail.versions].sort((a, b) => b.version - a.version);
  return (
    <section aria-labelledby="versions-h" className={s.historyBlock}>
      <h3 id="versions-h" className={s.subhead}>{c.versions.title}</h3>
      <ol className={s.versionList} aria-label={c.versions.caption}>
        {versions.map((v) => (
          <li key={v.id} className={s.versionItem}>
            <div className={s.reviewTop}>
              <strong>
                v{v.version}
                {v.version === detail.currentVersion ? ` · ${c.versions.current}` : ""}
              </strong>
              <ReviewStateBadge state={v.reviewState} />
            </div>
            <p className={s.commentBody}>{cleanNote(v.changeNote)}</p>
            <div className={s.meta}>
              {v.authorName} · <time dateTime={v.createdAt} title={formatDateTime(v.createdAt)}>{relativeTime(v.createdAt)}</time>
              {v.approvedAt ? (
                <>
                  {" · "}
                  <time dateTime={v.approvedAt}>{c.versions.approvedAt(formatDateTime(v.approvedAt))}</time>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
