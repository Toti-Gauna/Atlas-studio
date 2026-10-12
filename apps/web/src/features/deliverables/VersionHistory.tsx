import type { ArtifactDetail } from "@atlas/contracts";
import { formatDateTime, relativeTime } from "@/lib/format";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Badge, Card, SectionHead } from "@/components/ui";
import { REVIEW_LABEL, REVIEW_TONE } from "@/features/artifacts/ArtifactWorkspace";
import { cleanNote } from "./queries";
import s from "./deliverables.module.css";

export function VersionHistory({ detail }: { detail: ArtifactDetail }) {
  const versions = [...detail.versions].sort((a, b) => b.version - a.version);
  return (
    <Card as="section" aria-labelledby="versions-h">
      <SectionHead id="versions-h" title={c.versions.title} aside={String(versions.length)} />
      <ol className={s.versionList} aria-label={c.versions.caption}>
        {versions.map((v) => (
          <li key={v.id} className={s.versionItem}>
            <div className={s.reviewTop}>
              <Badge mono tone={v.version === detail.currentVersion ? "teal" : "neutral"}>
                v{v.version}
                {v.version === detail.currentVersion ? ` · ${c.versions.current}` : ""}
              </Badge>
              <Badge tone={REVIEW_TONE[v.reviewState]}>{REVIEW_LABEL[v.reviewState]}</Badge>
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
    </Card>
  );
}
