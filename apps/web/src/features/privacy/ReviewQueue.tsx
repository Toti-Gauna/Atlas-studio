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
import { Badge, Button, Callout, Card, EmptyState, Modal, QueryState, Table, TextArea, useToast } from "@/components/ui";
import { SEVERITY_TONE, STATUS_TONE } from "./tones";
import s from "./privacy.module.css";

type Decision = "redact" | "approve_original" | "reject";

function DecisionModal({ review, decision, onClose }: { review: RedactionReview; decision: Decision; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState("");
  const t = c.reviews.confirm[decision];
  const m = useMutation({
    mutationFn: () => api.privacy.decide(review.id, { decision, note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-reviews"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      if (review.documentId) void qc.invalidateQueries({ queryKey: ["document", review.documentId] });
      toast({ tone: "success", title: c.reviews.done[decision] ?? copy.actions.confirm, body: review.documentTitle ?? c.reviews.composer });
      onClose();
    },
    onError: (e) => toast({ tone: "error", title: c.reviews.failed, body: (e as Error).message }),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t.title}
      description={review.documentTitle ?? c.reviews.composer}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{copy.actions.cancel}</Button>
          <Button variant={decision === "reject" ? "danger" : "primary"} onClick={() => m.mutate()} loading={m.isPending}>
            {t.cta}
          </Button>
        </>
      }
    >
      <div className={s.stack}>
        <p>{t.body}</p>
        <Callout tone="teal" icon={<CloudOff size={16} aria-hidden />}>{c.reviews.confirm.local}</Callout>
        <TextArea label={c.reviews.confirm.note} value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function ReviewCard({ r, canDecide, onDecide }: { r: RedactionReview; canDecide: boolean; onDecide: (d: Decision) => void }) {
  const title = r.documentTitle ?? c.reviews.composer;
  const pending = r.status === "pending_review";
  return (
    <Card as="li" className={s.review}>
      <div className={s.reviewHead}>
        <div style={{ minWidth: 0 }}>
          <h3 className={s.reviewTitle}>{r.documentId ? <Link href={`/app/document/?id=${r.documentId}`}>{title}</Link> : title}</h3>
          <p className={s.muted}>
            {c.reviews.created} {relativeTime(r.createdAt)} · {c.reviews.findings(r.findings.length)}
            {r.decidedAt ? ` · ${c.reviews.decided} ${formatDateTime(r.decidedAt)}` : ""}
          </p>
        </div>
        <div className={s.badges}>
          <Badge tone={STATUS_TONE[r.status]}>{c.reviewStatus[r.status]}</Badge>
          <Badge tone="violet" title={c.reviews.suggested}>
            {c.reviews.suggested}: {c.classification[r.suggestedClassification]}
          </Badge>
        </div>
      </div>
      <Table caption={`${c.reviews.caption} · ${title}`}>
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
              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{f.label}</td>
              <td className="mono">{f.preview}</td>
              <td><Badge tone={SEVERITY_TONE[f.severity]}>{c.severity[f.severity]}</Badge></td>
              <td className={s.muted}>{f.explanation}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {pending ? (
        canDecide ? (
          <div className={s.actions}>
            <Button variant="primary" onClick={() => onDecide("redact")}>{c.reviews.redact}</Button>
            <Button onClick={() => onDecide("approve_original")}>{c.reviews.approve}</Button>
            <Button variant="danger" onClick={() => onDecide("reject")}>{c.reviews.reject}</Button>
          </div>
        ) : (
          <p className={s.muted}>{c.reviews.adminOnly}</p>
        )
      ) : null}
    </Card>
  );
}

export function ReviewQueue({ query }: { query: UseQueryResult<RedactionReview[]> }) {
  const canDecide = useCan("privacy.admin");
  const [active, setActive] = useState<{ review: RedactionReview; decision: Decision } | null>(null);
  return (
    <>
      <QueryState query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.reviews.empty} body={c.reviews.emptyBody} />}>
        {(list) => {
          const sorted = [...list].sort((a, b) => Number(b.status === "pending_review") - Number(a.status === "pending_review") || b.createdAt.localeCompare(a.createdAt));
          return (
            <ul className={s.list}>
              {sorted.map((r) => (
                <ReviewCard key={r.id} r={r} canDecide={canDecide} onDecide={(decision) => setActive({ review: r, decision })} />
              ))}
            </ul>
          );
        }}
      </QueryState>
      {active ? <DecisionModal review={active.review} decision={active.decision} onClose={() => setActive(null)} /> : null}
    </>
  );
}
