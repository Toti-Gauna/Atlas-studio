"use client";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Send } from "lucide-react";
import type { ArtifactDetail, ReviewRequest } from "@atlas/contracts";
import { canOnArtifact } from "@atlas/domain";
import { api, isApiError } from "@/lib/api";
import { useCan, useSession } from "@/lib/state/session";
import { reviewsCopy as c } from "@/copy/reviews";
import { Button, Callout, ErrorState, LoadingBlock, Select, useToast } from "@/components/ui";
import { Popover } from "@/components/ui";
import { keys, useAllReviews, useMembers } from "./queries";
import { ReviewDecision } from "./ReviewDecision";
import { ReviewRequestItem } from "./ReviewRequestItem";
import s from "./deliverables.module.css";

function useArtifactReviews(detail: ArtifactDetail) {
  const reviews = useAllReviews();
  const mine = useMemo(
    () => (reviews.data ?? []).filter((r) => r.artifactId === detail.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews.data, detail.id],
  );
  const openOnCurrent = mine.find((r) => r.status === "open" && r.version === detail.currentVersion);
  return { reviews, mine, openOnCurrent };
}

function useRefresh(detail: ArtifactDetail) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["reviews"] });
    void qc.invalidateQueries({ queryKey: keys.artifact(detail.id) });
    void qc.invalidateQueries({ queryKey: keys.artifacts });
    void qc.invalidateQueries({ queryKey: keys.shares(detail.id) });
  };
}

/** Header action: request a review of the current version in one step (reviewer + send). */
export function RequestReview({ detail }: { detail: ArtifactDetail }) {
  const toast = useToast();
  const { data: session } = useSession();
  const canWrite = useCan("artifact.write") && canOnArtifact(detail.myRole, "edit");
  const { openOnCurrent } = useArtifactReviews(detail);
  const [reviewerId, setReviewerId] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const members = useMembers(canWrite);
  const refresh = useRefresh(detail);
  const cur = detail.currentVersion;
  const reviewerOptions = (members.data ?? []).filter((m) => (m.role === "reviewer" || m.role === "admin") && m.user.id !== session?.user.id);

  const request = useMutation({
    mutationFn: () => api.reviews.request({ artifactId: detail.id, version: cur, reviewerId }),
    onSuccess: (r) => {
      refresh();
      setReviewerId("");
      setConflict(null);
      toast({ tone: "success", title: c.panel.requested(r.version, r.reviewerName) });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "CONFLICT") setConflict(e.message || c.panel.conflict);
      else toast({ tone: "error", title: c.panel.requestFailed, body: (e as Error).message });
    },
  });

  if (!canWrite) return null;
  if (openOnCurrent) return <span className={s.headerNote}>{c.panel.alreadyOpen(cur, openOnCurrent.reviewerName)}</span>;
  return (
    <Popover
      label={c.panel.request(cur)}
      align="end"
      trigger={(p) => (
        <Button icon={<Send size={14} aria-hidden />} {...p}>
          {c.panel.requestShort}
          <ChevronDown size={13} aria-hidden />
        </Button>
      )}
    >
      {(close) => (
        <form
          className={s.popForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (reviewerId) request.mutate(undefined, { onSuccess: close });
          }}
        >
          <p className={s.popTitle}>{c.panel.request(cur)}</p>
          {conflict ? (
            <Callout tone="danger">
              <p>{conflict}</p>
              <Button size="sm" icon={<RefreshCw size={13} aria-hidden />} className={s.calloutAction} onClick={() => { setConflict(null); refresh(); }}>
                {c.panel.reload}
              </Button>
            </Callout>
          ) : null}
          {members.isError ? (
            <ErrorState error={members.error} compact onRetry={() => void members.refetch()} />
          ) : (
            <Select
              label={c.panel.reviewer}
              value={reviewerId}
              disabled={members.isPending}
              onChange={(e) => setReviewerId(e.target.value)}
              options={[{ value: "", label: members.isPending ? c.panel.loadingMembers : c.panel.pickReviewer }, ...reviewerOptions.map((m) => ({ value: m.user.id, label: m.user.displayName }))]}
            />
          )}
          {members.isSuccess && reviewerOptions.length === 0 ? <p className={s.muted}>{c.panel.noReviewers}</p> : null}
          <Button type="submit" variant="primary" icon={<Send size={14} aria-hidden />} disabled={!reviewerId} loading={request.isPending}>
            {c.panel.send}
          </Button>
        </form>
      )}
    </Popover>
  );
}

/** Shown to the assigned reviewer (or an admin) while a review of the current version is open. */
export function ReviewDecisionCard({ detail }: { detail: ArtifactDetail }) {
  const toast = useToast();
  const { data: session } = useSession();
  const canDecide = useCan("review.decide");
  const { openOnCurrent } = useArtifactReviews(detail);
  const [conflict, setConflict] = useState<string | null>(null);
  const refresh = useRefresh(detail);
  const decide = useMutation({
    mutationFn: (v: { r: ReviewRequest; decision: "approve" | "request_changes"; note: string }) =>
      api.reviews.decide(v.r.id, { version: v.r.version, decision: v.decision, note: v.note.trim() || undefined }),
    onSuccess: (r) => {
      refresh();
      setConflict(null);
      toast({ tone: "success", title: r.status === "approved" ? c.panel.approved(r.version) : c.panel.changesRequested(r.version) });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "CONFLICT") setConflict(e.message || c.panel.conflict);
      else toast({ tone: "error", title: c.panel.decideFailed, body: (e as Error).message });
    },
  });
  const canDecideThis = Boolean(openOnCurrent && canDecide && session && (openOnCurrent.reviewerId === session.user.id || session.role === "admin"));
  if (conflict) {
    return (
      <Callout tone="danger">
        <p>{conflict}</p>
        <Button size="sm" icon={<RefreshCw size={13} aria-hidden />} className={s.calloutAction} onClick={() => { setConflict(null); refresh(); }}>
          {c.panel.reload}
        </Button>
      </Callout>
    );
  }
  if (!canDecideThis || !openOnCurrent) return null;
  return (
    <div aria-live="polite">
      <ReviewDecision request={openOnCurrent} pending={decide.isPending ? (decide.variables?.decision ?? null) : null} onDecide={(decision, note) => decide.mutate({ r: openOnCurrent, decision, note })} />
    </div>
  );
}

/** Review requests on every version, for the History tab. */
export function ReviewHistory({ detail }: { detail: ArtifactDetail }) {
  const { reviews, mine } = useArtifactReviews(detail);
  return (
    <section aria-labelledby="reviews-h" className={s.historyBlock}>
      <h3 id="reviews-h" className={s.subhead}>{c.panel.title}</h3>
      {reviews.isPending ? (
        <LoadingBlock rows={2} />
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} compact onRetry={() => void reviews.refetch()} />
      ) : mine.length === 0 ? (
        <p className={s.muted}>{c.panel.empty}</p>
      ) : (
        <ul className={s.plainList}>
          {mine.map((r) => (
            <ReviewRequestItem key={r.id} r={r} currentVersion={detail.currentVersion} />
          ))}
        </ul>
      )}
    </section>
  );
}
