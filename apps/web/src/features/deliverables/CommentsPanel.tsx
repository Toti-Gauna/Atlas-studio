"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import type { ArtifactDetail, ReviewComment } from "@atlas/contracts";
import { canOnArtifact } from "@atlas/domain";
import { api, isApiError } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Avatar, Button, Callout, Card, ErrorState, LoadingBlock, SectionHead, TextArea, TextField, useToast } from "@/components/ui";
import { keys } from "./queries";
import s from "./deliverables.module.css";

export function CommentsPanel({ detail }: { detail: ArtifactDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const cur = detail.currentVersion;
  const [forbidden, setForbidden] = useState(false);
  const canComment = canOnArtifact(detail.myRole, "comment") && !forbidden;
  const [text, setText] = useState("");
  const [anchor, setAnchor] = useState("");
  const comments = useQuery({ queryKey: keys.comments(detail.id), queryFn: () => api.artifacts.comments(detail.id) });

  const groups = useMemo(() => {
    const by = new Map<number, ReviewComment[]>();
    for (const cm of comments.data ?? []) by.set(cm.version, [...(by.get(cm.version) ?? []), cm]);
    return [...by.entries()].sort(([a], [b]) => (a === cur ? -1 : b === cur ? 1 : b - a));
  }, [comments.data, cur]);

  const post = useMutation({
    mutationFn: () => api.artifacts.comment(detail.id, { version: cur, body: text.trim(), anchor: anchor.trim() || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.comments(detail.id) });
      setText("");
      setAnchor("");
      toast({ tone: "success", title: c.comments.posted });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "FORBIDDEN") setForbidden(true);
      toast({ tone: "error", title: c.comments.failed, body: (e as Error).message });
    },
  });

  return (
    <Card as="section" aria-labelledby="comments-h">
      <SectionHead id="comments-h" title={c.comments.title} aside={comments.data ? String(comments.data.length) : undefined} />
      <div className={s.panelBody}>
        {comments.isPending ? (
          <LoadingBlock rows={2} />
        ) : comments.isError ? (
          <ErrorState error={comments.error} compact onRetry={() => void comments.refetch()} />
        ) : groups.length === 0 ? (
          <p className={s.muted}>{c.comments.empty}</p>
        ) : (
          groups.map(([v, list]) => (
            <section key={v} aria-label={c.comments.onVersion(v, v === cur)}>
              <h3 className={s.subhead}>{c.comments.onVersion(v, v === cur)}</h3>
              <ul className={s.plainList}>
                {list.map((cm) => (
                  <li key={cm.id} className={s.comment}>
                    <Avatar name={cm.authorName} size={24} />
                    <div className={s.grow}>
                      <div className={s.meta}>
                        <strong className={s.author}>{cm.authorName}</strong> ·{" "}
                        <time dateTime={cm.createdAt} title={formatDateTime(cm.createdAt)}>{relativeTime(cm.createdAt)}</time>
                        {cm.resolved ? " · resolved" : ""}
                      </div>
                      {cm.anchor ? <blockquote className={s.quote}>{cm.anchor}</blockquote> : null}
                      <p className={s.commentBody}>{cm.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {canComment ? (
          <form
            className={s.stackForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) post.mutate();
            }}
          >
            <TextField label={c.comments.anchor} hint={c.comments.anchorHint} value={anchor} maxLength={300} onChange={(e) => setAnchor(e.target.value)} />
            <TextArea label={c.comments.label} rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
            <div>
              <Button type="submit" icon={<MessageSquare size={14} aria-hidden />} disabled={!text.trim()} loading={post.isPending}>
                {c.comments.post} on v{cur}
              </Button>
            </div>
          </form>
        ) : (
          <Callout>{c.comments.viewerOnly}</Callout>
        )}
      </div>
    </Card>
  );
}
