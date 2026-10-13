"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import type { RedactionReview } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { copy } from "@/copy/en";
import { privacyCopy as c } from "@/copy/privacy";
import { Badge, Button, Callout, Card, EmptyState, Modal, QueryState, StatusBadge, Table, TextArea, useToast } from "@/components/ui";
import { SEVERITY_TONE } from "./tones";
import s from "./privacy.module.css";

type Decision = "redact" | "approve_original" | "reject";
type Confirmed = Exclude<Decision, "redact">;

/** Shared decision request + cache refresh + toast. */
function useDecide(review: RedactionReview, onDone?: () => void) {
  const qc = useQueryClient();
  const toast = useToast();
  const title = review.documentTitle ?? c.reviews.composer;
  return useMutation({
    mutationFn: ({ decision, note }: { decision: Decision; note?: string }) => api.privacy.decide(review.id, { decision, note }),
    onSuccess: (_r, { decision }) => {
      void qc.invalidateQueries({ queryKey: ["privacy-reviews"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      if (review.documentId) void qc.invalidateQueries({ queryKey: ["document", review.documentId] });
      toast({ tone: "success", title: c.reviews.done[decision] ?? copy.actions.confirm, body: decision === "redact" ? c.reviews.redactedBody(title) : title });
      onDone?.();
    },
    onError: (e) => toast({ tone: "error", title: c.reviews.failed, body: (e as Error).message }),
  });
}

/** Approving the original or rejecting changes what may leave Atlas, so both are confirmed. */
function DecisionModal({ review, decision, onClose }: { review: RedactionReview; decision: Confirmed; onClose: () => void }) {
  const [note, setNote] = useState("");
  const t = c.reviews.confirm[decision];
  const m = useDecide(review, onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title={t.title}
      description={review.documentTitle ?? c.reviews.composer}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{copy.actions.cancel}</Button>
          <Button variant={decision === "reject" ? "danger" : "primary"} onClick={() => m.mutate({ decision, note: note.trim() || undefined })} loading={m.isPending}>
            {t.cta}
          </Button>
        </>
      }
    >
      <div className={s.stack}>
        <p>{t.body}</p>
        <Callout icon={<CloudOff size={16} aria-hidden />}>{c.reviews.confirm.local}</Callout>
        <TextArea label={c.reviews.confirm.note} value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function ReviewCard({ r, canDecide, onConfirm }: { r: RedactionReview; canDecide: boolean; onConfirm: (d: Confirmed) => void }) {
  const title = r.documentTitle ?? c.reviews.composer;
  const pending = r.status === "pending_review";
  const redact = useDecide(r);
  return (
    <Card as="li" className={s.review}>
      <div className={s.reviewHead}>
        <div className={s.reviewMain}>
          <p className={s.itemLabel}>{c.reviews.itemLabel}</p>
          <h3 className={s.reviewTitle}>{r.documentId ? <Link href={`/app/document/?id=${r.documentId}`}>{title}</Link> : title}</h3>
          <p className={s.muted}>
            {c.reviews.created} {relativeTime(r.createdAt)} · {c.reviews.findings(r.findings.length)} · {c.reviews.suggested}: {c.classification[r.suggestedClassification]}
            {r.decidedAt ? ` · ${c.reviews.decided} ${formatDateTime(r.decidedAt)}` : ""}
          </p>
        </div>
        <StatusBadge kind="privacy" status={r.status} />
      </div>
      <Table stack caption={`${c.reviews.caption} · ${title}`}>
        <thead>
          <tr>
            <th scope="col">{c.reviews.detector}</th>
            <th scope="col">{c.reviews.preview}</th>
            <th scope="col">{c.reviews.severity}</th>
            <th scope="col">{c.reviews.why}</th>
          </tr>
        </thead>
        <tbody>
          {r.findings.map((f, i) => (
            <tr key={i}>
              <td className={s.detector}>{f.label}</td>
              <td className="mono" data-label={c.reviews.preview}>{f.preview}</td>
              <td data-label={c.reviews.severity}>
                <Badge tone={SEVERITY_TONE[f.severity]}>{c.severity[f.severity]}</Badge>
              </td>
              <td className={s.muted} data-label={c.reviews.why}>
                {f.explanation}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {pending ? (
        canDecide ? (
          <div className={s.decide}>
            <div className={s.actions}>
              <Button variant="primary" loading={redact.isPending} onClick={() => redact.mutate({ decision: "redact" })}>
                {c.reviews.redact}
              </Button>
              <Button onClick={() => onConfirm("approve_original")}>{c.reviews.approve}</Button>
              <Button variant="ghost" onClick={() => onConfirm("reject")}>
                {c.reviews.reject}
              </Button>
            </div>
            <p className={s.muted}>{c.reviews.redactHint}</p>
          </div>
        ) : (
          <p className={s.muted}>{c.reviews.adminOnly}</p>
        )
      ) : null}
    </Card>
  );
}

/** Sensitive data waiting for a person: Redact applies directly; approving the original or rejecting asks first. */
export function ReviewQueue({ query }: { query: UseQueryResult<RedactionReview[]> }) {
  const canDecide = useCan("privacy.admin");
  const [active, setActive] = useState<{ review: RedactionReview; decision: Confirmed } | null>(null);
  return (
    <>
      <QueryState query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.reviews.empty} body={c.reviews.emptyBody} />}>
        {(list) => {
          const sorted = [...list].sort((a, b) => Number(b.status === "pending_review") - Number(a.status === "pending_review") || b.createdAt.localeCompare(a.createdAt));
          return (
            <ul className={s.list}>
              {sorted.map((r) => (
                <ReviewCard key={r.id} r={r} canDecide={canDecide} onConfirm={(decision) => setActive({ review: r, decision })} />
              ))}
            </ul>
          );
        }}
      </QueryState>
      {active ? <DecisionModal review={active.review} decision={active.decision} onClose={() => setActive(null)} /> : null}
    </>
  );
}
