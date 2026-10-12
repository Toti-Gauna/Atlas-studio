"use client";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import type { ArtifactDetail, ReviewRequest } from "@atlas/contracts";
import { canOnArtifact } from "@atlas/domain";
import { api, isApiError } from "@/lib/api";
import { useCan, useSession } from "@/lib/state/session";
import { reviewsCopy as c } from "@/copy/reviews";
import { Button, Callout, Card, ErrorState, LoadingBlock, SectionHead, Select, useToast } from "@/components/ui";
import { keys, useAllReviews, useMembers } from "./queries";
import { ReviewDecision } from "./ReviewDecision";
import { ReviewRequestItem } from "./ReviewRequestItem";
import s from "./deliverables.module.css";

export function ReviewPanel({ detail }: { detail: ArtifactDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: session } = useSession();
  const canWrite = useCan("artifact.write") && canOnArtifact(detail.myRole, "edit");
  const canDecide = useCan("review.decide");
  const reviews = useAllReviews();
  const [showForm, setShowForm] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const members = useMembers(canWrite && showForm);
  const cur = detail.currentVersion;

  const mine = useMemo(
    () => (reviews.data ?? []).filter((r) => r.artifactId === detail.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews.data, detail.id],
  );
  const openOnCurrent = mine.find((r) => r.status === "open" && r.version === cur);
  const canDecideThis = Boolean(openOnCurrent && canDecide && session && (openOnCurrent.reviewerId === session.user.id || session.role === "admin"));
  const reviewerOptions = (members.data ?? []).filter((m) => (m.role === "reviewer" || m.role === "admin") && m.user.id !== session?.user.id);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["reviews"] });
    void qc.invalidateQueries({ queryKey: keys.artifact(detail.id) });
    void qc.invalidateQueries({ queryKey: keys.artifacts });
    void qc.invalidateQueries({ queryKey: keys.shares(detail.id) });
  };
  const onFail = (title: string) => (e: unknown) => {
    if (isApiError(e) && e.code === "CONFLICT") setConflict(e.message || c.panel.conflict);
    else toast({ tone: "error", title, body: (e as Error).message });
  };

  const request = useMutation({
    mutationFn: () => api.reviews.request({ artifactId: detail.id, version: cur, reviewerId }),
    onSuccess: (r) => {
      refresh();
      setShowForm(false);
      setReviewerId("");
      setConflict(null);
      toast({ tone: "success", title: c.panel.requested(r.version, r.reviewerName) });
    },
    onError: onFail(c.panel.requestFailed),
  });
  const decide = useMutation({
    mutationFn: (v: { r: ReviewRequest; decision: "approve" | "request_changes"; note: string }) =>
      api.reviews.decide(v.r.id, { version: v.r.version, decision: v.decision, note: v.note.trim() || undefined }),
    onSuccess: (r) => {
      refresh();
      setConflict(null);
      toast({ tone: "success", title: r.status === "approved" ? c.panel.approved(r.version) : c.panel.changesRequested(r.version) });
    },
    onError: onFail(c.panel.decideFailed),
  });

  return (
    <Card as="section" aria-labelledby="review-h">
      <SectionHead id="review-h" title={c.panel.title} />
      <p className={s.muted}>{c.panel.explain}</p>
      <div className={s.panelBody} aria-live="polite">
        {conflict ? (
          <Callout tone="danger">
            <p>{conflict}</p>
            <Button size="sm" icon={<RefreshCw size={13} aria-hidden />} onClick={() => { setConflict(null); refresh(); }} style={{ marginTop: 8 }}>
              {c.panel.reload}
            </Button>
          </Callout>
        ) : null}

        {canDecideThis && openOnCurrent ? (
          <ReviewDecision request={openOnCurrent} pending={decide.isPending ? decide.variables?.decision ?? null : null} onDecide={(decision, note) => decide.mutate({ r: openOnCurrent, decision, note })} />
        ) : null}

        {reviews.isPending ? (
          <LoadingBlock rows={2} />
        ) : reviews.isError ? (
          <ErrorState error={reviews.error} compact onRetry={() => void reviews.refetch()} />
        ) : mine.length === 0 ? (
          <p className={s.muted}>{c.panel.empty}</p>
        ) : (
          <ul className={s.plainList}>
            {mine.map((r) => (
              <ReviewRequestItem key={r.id} r={r} currentVersion={cur} />
            ))}
          </ul>
        )}

        {canWrite ? (
          showForm ? (
            <form
              className={s.inlineForm}
              onSubmit={(e) => {
                e.preventDefault();
                if (reviewerId) request.mutate();
              }}
            >
              {members.isError ? (
                <ErrorState error={members.error} compact onRetry={() => void members.refetch()} />
              ) : (
                <Select
                  label={c.panel.reviewer}
                  value={reviewerId}
                  disabled={members.isPending}
                  onChange={(e) => setReviewerId(e.target.value)}
                  options={[{ value: "", label: members.isPending ? "Loading members…" : c.panel.pickReviewer }, ...reviewerOptions.map((m) => ({ value: m.user.id, label: `${m.user.displayName} (${m.role})` }))]}
                />
              )}
              {members.isSuccess && reviewerOptions.length === 0 ? <p className={s.muted}>{c.panel.noReviewers}</p> : null}
              <Button type="submit" variant="primary" icon={<Send size={14} aria-hidden />} disabled={!reviewerId} loading={request.isPending}>
                {c.panel.send}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </form>
          ) : openOnCurrent ? (
            <p className={s.muted}>{c.panel.alreadyOpen(cur, openOnCurrent.reviewerName)}</p>
          ) : (
            <Button icon={<Send size={14} aria-hidden />} onClick={() => setShowForm(true)}>
              {c.panel.request(cur)}
            </Button>
          )
        ) : null}
      </div>
    </Card>
  );
}
